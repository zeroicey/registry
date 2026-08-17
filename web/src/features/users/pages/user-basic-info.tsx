import { formatDateTime } from '@/lib/datetime';
import type { UserDto } from '../types';

interface InfoCellProps {
  label: string;
  value: string;
}

function InfoCell({ label, value }: InfoCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * 基本信息只读展示：姓名 / 身份证号 / 创建与更新时间，
 * 响应式网格（移动端一列，宽屏一行四个）。
 */
export function UserBasicInfo({ user }: { user: UserDto }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      <InfoCell label="姓名" value={user.realName} />
      <InfoCell label="身份证号" value={user.code ?? '—'} />
      <InfoCell label="创建时间" value={formatDateTime(user.createdAt)} />
      <InfoCell label="更新时间" value={formatDateTime(user.updatedAt)} />
    </dl>
  );
}
