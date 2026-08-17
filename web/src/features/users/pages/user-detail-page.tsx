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
import { cn } from '@/lib/utils';
import { UserEditDialog } from '../components/user-edit-dialog';
import { useDeleteUser, useUser } from '../queries';

const TAB_LINKS = [
  { to: '', label: '资料', end: true },
  { to: 'comments', label: '留言', end: false },
];

/**
 * 详情页壳：单行 header（名字 + Tab + 图标操作按钮）+ Outlet。
 * 编辑弹窗（基本信息和属性一体编辑）在头部，任何 Tab 下都可进入；
 * 留言 Tab 独立子路由（后续将加附件等能力）。
 */
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
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{user.realName}</h1>
          <nav aria-label="人员详情页签" className="flex gap-0.5 self-stretch">
            {TAB_LINKS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    '-mb-px flex items-center border-b-2 px-2.5 text-sm transition-colors',
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
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label="编辑" onClick={() => setEditOpen(true)}>
            <PencilIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="删除"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>

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
