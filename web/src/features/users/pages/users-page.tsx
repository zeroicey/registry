import { SearchIcon, UsersIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
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
import { Input } from '@/components/ui/input';
import { useAttributeDefs } from '@/features/attributes/queries';
import { UserFilterBar } from '../components/user-filter-bar';
import { UsersTable } from '../components/users-table';
import { useDeleteUser, useUsers } from '../queries';
import type { AttributeFilterValue, UserSummaryDto } from '../types';

const PAGE_SIZE = 20;

/** 人员列表页：搜索 + 属性筛选条 + 数据表格 + 翻页 + 新建/删除。 */
export function UsersPage() {
  const navigate = useNavigate();
  const { data: defs } = useAttributeDefs();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AttributeFilterValue[]>([]);
  const [deleting, setDeleting] = useState<UserSummaryDto | undefined>(undefined);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useUsers({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    filters,
  });

  const deleteMutation = useDeleteUser();
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const openDetail = (user: UserSummaryDto) => navigate(`/users/${user.id}`);

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSettled: () => setDeleting(undefined),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">人员</h1>
          <p className="text-sm text-muted-foreground">登记与查询人员档案。</p>
        </div>
        <Button onClick={() => navigate('/users/new')}>
          <UsersIcon className="size-4" />
          新建人员
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <SearchIcon
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索姓名 / 工号"
            className="pl-8"
            aria-label="搜索姓名或工号"
          />
        </div>
        <UserFilterBar defs={defs ?? []} filters={filters} onChange={setFilters} />
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <UsersIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">人员加载失败</p>
          <Button variant="outline" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <UsersIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {filters.length > 0 || search ? '没有符合条件的人员。' : '还没有人员，点击右上角新建。'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <UsersTable
            users={data?.items ?? []}
            onView={openDetail}
            onEdit={openDetail}
            onDelete={setDeleting}
          />
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {data.total} 人</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <span>
              第 {page} / {totalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除人员</DialogTitle>
            <DialogDescription>
              确定删除「{deleting?.realName ?? ''}
              」吗？删除后不再出现在列表中，但其档案与留言历史仍会保留（软删除），不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(undefined)}>
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
