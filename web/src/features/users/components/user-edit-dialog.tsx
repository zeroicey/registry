import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { toDisplayError } from '@/api/errors';
import { AttributeFields, buildProfileSchema } from '@/components/common/attribute-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAttributeDefs } from '@/features/attributes/queries';
import { scopeToCollectionId, useCollectionStore } from '@/stores/collection-store';
import { updateProfile as updateProfileRequest, updateUser as updateUserRequest } from '../api';
import { userKeys } from '../queries';
import { toUpdateUserInput, userBaseSchema } from '../schemas';
import type { UserDto } from '../types';

interface EditFormValues {
  realName: string;
  code: string;
  profile: Record<string, unknown>;
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Deep compare against the backend's own `valuesEqual` semantics. */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge-patch payload: only keys whose normalized value differs from the
 * current profile are submitted (blank inputs are dropped entirely).
 */
function buildProfilePatch(
  original: Record<string, unknown>,
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue; // left blank — not touched
    if (!jsonEqual(value, original[key])) patch[key] = value;
  }
  return patch;
}

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user being edited — basic info and profile both edit here. */
  user: UserDto;
}

/**
 * 资料编辑弹窗：基本信息（姓名/身份证号）+ 属性字段一体编辑。
 * 保存时按改动拆分请求：基本信息走 PATCH /users/:id，属性走 PATCH /users/:id/profile。
 */
export function UserEditDialog({ open, onOpenChange, user }: UserEditDialogProps) {
  const queryClient = useQueryClient();
  const scope = useCollectionStore((s) => s.scope);
  const collectionId = scopeToCollectionId(scope);
  const { data: defs } = useAttributeDefs(scope);
  const [isSaving, setIsSaving] = useState(false);

  const profileSchema = useMemo(() => buildProfileSchema(defs ?? []), [defs]);
  const resolver = useMemo(
    () =>
      zodResolver(
        z.object({
          realName: userBaseSchema.shape.realName,
          code: userBaseSchema.shape.code,
          profile: profileSchema,
        }),
      ),
    [profileSchema],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver,
    defaultValues: { realName: '', code: '', profile: {} },
  });

  // Re-seed the form whenever the dialog opens for a (possibly different) user.
  useEffect(() => {
    if (open) {
      reset({ realName: user.realName, code: user.code ?? '', profile: { ...user.profile } });
    }
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const baseChanged =
      values.realName.trim() !== user.realName ||
      (values.code.trim() === '' ? null : values.code.trim()) !== user.code;
    const parsed = profileSchema.safeParse(values.profile);
    if (!parsed.success) return;
    const patch = buildProfilePatch(user.profile, parsed.data);
    if (!baseChanged && Object.keys(patch).length === 0) {
      onOpenChange(false); // nothing changed — just close
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all([
        baseChanged
          ? updateUserRequest(
              user.id,
              toUpdateUserInput({ realName: values.realName, code: values.code }),
            )
          : Promise.resolve(undefined),
        Object.keys(patch).length > 0
          ? updateProfileRequest(user.id, {
              profiles: patch,
              ...(collectionId !== undefined ? { collectionId } : {}),
            })
          : Promise.resolve(undefined),
      ]);
      toast.success('资料已保存');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      onOpenChange(false);
    } catch (error) {
      toast.error(toDisplayError(error));
    } finally {
      setIsSaving(false);
    }
  });

  const hasFields = defs !== undefined && defs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑资料</DialogTitle>
          <DialogDescription>
            修改「{user.realName}」的基本信息与属性，保存后立即生效。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">基本信息</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-realName">姓名</Label>
                <Input id="edit-realName" placeholder="如：张三" {...register('realName')} />
                <FieldError message={errors.realName?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-code">身份证号（可选）</Label>
                <Input id="edit-code" placeholder="如：1001" {...register('code')} />
                <FieldError message={errors.code?.message} />
              </div>
            </div>
          </div>

          {hasFields && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">属性</p>
              <AttributeFields
                defs={defs}
                control={control}
                errors={errors.profile}
                namePrefix="profile"
                className="grid gap-4 sm:grid-cols-2"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2Icon className="size-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
