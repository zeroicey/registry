import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { PageLoading } from '@/app/layout/page-loading';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { UserEditDialog } from '../components/user-edit-dialog';
import { useDeleteUser, useUser } from '../queries';

const TAB_LINKS = [
  { to: 'basic', label: '基本信息' },
  { to: 'profile', label: '属性' },
  { to: 'comments', label: '留言' },
];

/** 详情页壳：头部信息条 + Tab 栏（嵌套子路由）+ Outlet。 */
export function UserDetailPage() {
  const { id } = useParams();
  const userId = Number(id);
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useUser(userId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteUser();

  const confirmDelete = () => {
    if (!user) return;
    deleteMutation.mutate(user.id, {
      onSuccess: () => navigate('/users', { replace: true }),
      onSettled: () => setDeleteOpen(false),
    });
  };

  if (isLoading) return <PageLoading />;
  if (isError || !user) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">人员信息加载失败。</p>
        <Button variant="outline" onClick={() => navigate('/users')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{user.realName}</h1>
          <span className="text-sm text-muted-foreground">身份证号 {user.code ?? '—'}</span>
          <span className="text-xs text-muted-foreground">
            更新于 {formatDateTime(user.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilIcon className="size-3.5" />
            编辑
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
            删除
          </Button>
        </div>
      </div>

      <nav aria-label="人员详情页签" className="flex gap-1 border-b">
        {TAB_LINKS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === 'basic'}
            className={({ isActive }) =>
              cn(
                'border-b-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />

      <UserEditDialog open={editOpen} onOpenChange={setEditOpen} user={user} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除人员</DialogTitle>
            <DialogDescription>
              确定删除「{user.realName}
              」吗？删除后不再出现在列表中，但其档案与留言历史仍会保留（软删除），不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={confirmDelete}
            >
              {deleteMutation.isPending ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
