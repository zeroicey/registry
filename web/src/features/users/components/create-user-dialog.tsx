import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { type FieldPath, useForm } from 'react-hook-form';
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
import type { AttributeDef } from '@/types/attribute';
import { useCreateUser } from '../queries';
import { type CreateUserFormValues, createUserFormSchema } from '../schemas';

const DEFAULT_VALUES: CreateUserFormValues = { realName: '', code: '', profile: {} };

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active attribute definitions driving the dynamic profile fields. */
  defs: AttributeDef[];
}

/** Create-user dialog: fixed basic fields + dynamic attribute profile fields. */
export function CreateUserDialog({ open, onOpenChange, defs }: CreateUserDialogProps) {
  const createMutation = useCreateUser();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Re-seed the form each time the dialog opens.
  useEffect(() => {
    if (open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  // Dynamic validator for the profile part — built from runtime attribute defs.
  const profileSchema = useMemo(() => buildProfileSchema(defs), [defs]);

  const onSubmit = handleSubmit((values) => {
    const result = profileSchema.safeParse(values.profile);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') {
          setError(`profile.${key}` as FieldPath<CreateUserFormValues>, {
            message: issue.message,
          });
        }
      }
      return;
    }

    // Drop blank/undefined values — the backend only upserts present keys.
    const profiles: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.data)) {
      if (value !== undefined) profiles[key] = value;
    }

    createMutation.mutate(
      {
        realName: values.realName,
        code: values.code === '' ? null : values.code,
        profiles,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建人员</DialogTitle>
          <DialogDescription>填写基本信息与属性档案，保存后可在详情页继续编辑。</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-realName">姓名</Label>
              <Input id="user-realName" placeholder="如：张三" {...register('realName')} />
              <FieldError message={errors.realName?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-code">工号（可选）</Label>
              <Input id="user-code" placeholder="如：1001" {...register('code')} />
              <FieldError message={errors.code?.message} />
            </div>
          </div>

          {defs.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <AttributeFields
                defs={defs}
                control={control}
                errors={errors.profile}
                namePrefix="profile"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
