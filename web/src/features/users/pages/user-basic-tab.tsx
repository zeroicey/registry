import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { PageLoading } from '@/app/layout/page-loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/datetime';
import { useUpdateUser, useUser } from '../queries';
import { toUpdateUserInput, type UserBaseFormValues, userBaseSchema } from '../schemas';

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/** 基本信息 Tab：只读字段 + 编辑切换为内联表单（PATCH /users/:id）。 */
export function UserBasicTab() {
  const { id } = useParams();
  const userId = Number(id);
  const { data: user, isLoading, isError } = useUser(userId);

  const [editing, setEditing] = useState(false);
  const updateMutation = useUpdateUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserBaseFormValues>({
    resolver: zodResolver(userBaseSchema),
    // Sync with the loaded user (RHF `values` re-syncs on every render).
    values: user ? { realName: user.realName, code: user.code ?? '' } : { realName: '', code: '' },
  });

  const onSubmit = handleSubmit((values) => {
    updateMutation.mutate(
      { id: userId, input: toUpdateUserInput(values) },
      { onSuccess: () => setEditing(false) },
    );
  });

  if (isLoading) return <PageLoading />;
  if (isError || !user) {
    return <p className="text-sm text-muted-foreground">人员信息加载失败。</p>;
  }

  if (editing) {
    return (
      <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="basic-realName">姓名</Label>
          <Input id="basic-realName" placeholder="如：张三" {...register('realName')} />
          <FieldError message={errors.realName?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="basic-code">身份证号（可选）</Label>
          <Input id="basic-code" placeholder="如：1001" {...register('code')} />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2Icon className="size-4 animate-spin" />}
            保存
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            取消
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="max-w-md rounded-lg border bg-card px-4 py-2">
      <dl className="divide-y">
        <InfoRow label="姓名" value={user.realName} />
        <InfoRow label="身份证号" value={user.code ?? '—'} />
        <InfoRow label="创建时间" value={formatDateTime(user.createdAt)} />
        <InfoRow label="更新时间" value={formatDateTime(user.updatedAt)} />
      </dl>
      <div className="flex justify-end py-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon className="size-3.5" />
          编辑
        </Button>
      </div>
    </div>
  );
}
