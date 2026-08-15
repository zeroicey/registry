import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { useUpdateUser } from '../queries';
import { toUpdateUserInput, type UserBaseFormValues, userBaseSchema } from '../schemas';
import type { UserSummaryDto } from '../types';

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user being edited (list row or detail header). */
  user: UserSummaryDto;
}

/** Edit basic info (realName / code) — profile attributes are edited on the profile tab. */
export function UserEditDialog({ open, onOpenChange, user }: UserEditDialogProps) {
  const updateMutation = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserBaseFormValues>({
    resolver: zodResolver(userBaseSchema),
    defaultValues: { realName: user.realName, code: user.code ?? '' },
  });

  // Re-seed the form whenever the dialog opens for a (possibly different) user.
  useEffect(() => {
    if (open) reset({ realName: user.realName, code: user.code ?? '' });
  }, [open, user, reset]);

  const onSubmit = handleSubmit((values) => {
    updateMutation.mutate(
      { id: user.id, input: toUpdateUserInput(values) },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>编辑人员</DialogTitle>
          <DialogDescription>
            修改「{user.realName}」的基本信息，属性档案请到属性页签编辑。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
