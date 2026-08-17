import { SearchIcon, UsersIcon, XIcon } from 'lucide-react';
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

/** 初始引导空态：尚未发起任何查询时展示。 */
function IdleNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <SearchIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        输入姓名 / 身份证号，或添加筛选条件，自动定向查找人员档案。
      </p>
    </div>
  );
}

/** 查询失败提示（含重试）。 */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <UsersIcon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">人员加载失败</p>
      <Button variant="outline" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/** 查询成功但无匹配（含清除条件入口）。 */
function EmptyResult({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <UsersIcon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">没有符合条件的人员。</p>
      <Button variant="ghost" size="sm" onClick={onClear}>
        清除条件
      </Button>
    </div>
  );
}

/**
 * 人员查询工作台：初始只展示搜索框 + 筛选器，不请求数据；
 * 输入（防抖 300ms）或增删筛选后自动定向查询，无需手动触发。
 */
export function UsersPage() {
  const navigate = useNavigate();
  const { data: defs } = useAttributeDefs();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AttributeFilterValue[]>([]);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<UserSummaryDto>();

  // 实时搜索：停止输入 300ms 后生效并回到第一页。
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 有任一条件才请求；条件全清空自动回到引导态（不显示全量）。
  const active = search !== '' || filters.length > 0;

  const changeFilters = (next: AttributeFilterValue[]) => {
    setFilters(next);
    setPage(1);
  };

  const clearAll = () => {
    setSearchInput('');
    setSearch('');
    setFilters([]);
    setPage(1);
  };

  const { data, isLoading, isError, refetch } = useUsers(
    {
      page,
      pageSize: PAGE_SIZE,
      search: active ? search : undefined,
      filters: active ? filters : [],
    },
    { enabled: active },
  );

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
            placeholder="搜索姓名 / 身份证号"
            className="pr-8 pl-8"
            aria-label="搜索姓名或身份证号"
          />
          {searchInput !== '' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="清除搜索"
              className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
              onClick={() => setSearchInput('')}
            >
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
        <UserFilterBar defs={defs ?? []} filters={filters} onChange={changeFilters} />
      </div>

      {!active ? (
        <IdleNotice />
      ) : isLoading ? (
        <PageLoading />
      ) : isError ? (
        <LoadError onRetry={() => refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyResult onClear={clearAll} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border bg-card">
            <UsersTable users={data?.items ?? []} onDetail={openDetail} onDelete={setDeleting} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>共 {data?.total ?? 0} 人</span>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <XIcon className="size-3.5" />
                清除条件
              </Button>
            </div>
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
