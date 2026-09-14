import { PlusIcon, SearchIcon, UsersIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
import { useAttributeDefs } from '@/features/attributes/queries';
import { scopeToCollectionId, useCollectionStore } from '@/stores/collection-store';
import { FilterChips, FilterDialog } from '../components/user-filter-bar';
import { UsersTable } from '../components/users-table';
import { useDeleteUser, useUsers } from '../queries';
import type { AttributeFilterValue, UserSummaryDto } from '../types';

const PAGE_SIZE = 20;

/** 列表场景里持久化到 URL 的保留键；其余 query 参数都视为属性筛选。 */
const LIST_SCENE_KEYS = new Set<string>(['search', 'page']);

interface ListScene {
  search: string;
  page: number;
  filters: AttributeFilterValue[];
}

/** 从 URL query 恢复列表场景（搜索词 + 筛选 + 页码）。 */
export function parseListScene(searchParams: URLSearchParams): ListScene {
  const search = searchParams.get('search') ?? '';
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const filters: AttributeFilterValue[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (LIST_SCENE_KEYS.has(key)) continue;
    filters.push({ key, value });
  }
  return { search, page, filters };
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = useCollectionStore((s) => s.scope);
  const collectionId = scopeToCollectionId(scope);
  const { data: defs } = useAttributeDefs(scope);

  // 从 URL 恢复搜索场景（搜索词 + 筛选 + 页码），使「返回列表」或浏览器后退
  // 后查询条件与结果都能保留。
  const [{ search: initialSearch, page: initialPage, filters: initialFilters }] = useState(() =>
    parseListScene(searchParams),
  );
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<AttributeFilterValue[]>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [deleting, setDeleting] = useState<UserSummaryDto>();

  // 实时搜索：停止输入 300ms 后生效；仅当搜索词真的变化时才回到第一页
  // （挂载时从 URL 恢复的 search 与 searchInput 一致，不会误重置页码）。
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      setSearch(next);
      if (next !== search) setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  // 把搜索/筛选/页码同步回 URL（replace，避免每次改动都叠加一条历史记录）。
  useEffect(() => {
    const next = new URLSearchParams();
    if (search !== '') next.set('search', search);
    if (page > 1) next.set('page', String(page));
    for (const filter of filters) next.set(filter.key, filter.value);
    setSearchParams(next, { replace: true });
  }, [search, filters, page, setSearchParams]);

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
      collectionId,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">人员</h1>
          <p className="text-sm text-muted-foreground">登记与查询人员档案。</p>
        </div>
        <Button onClick={() => navigate('/users/new')}>
          <UsersIcon className="size-4" />
          新建人员
        </Button>
      </div>

      <div className="flex w-full flex-col gap-2 md:max-w-2xl">
        <div className="flex flex-col gap-2 rounded-xl border border-input bg-transparent px-3 py-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <div className="flex items-center gap-2">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索姓名 / 身份证号"
              enterKeyHint="search"
              aria-label="搜索姓名或身份证号"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {searchInput !== '' && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="清除搜索"
                onClick={() => setSearchInput('')}
              >
                <XIcon className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="添加筛选"
              title="添加筛选"
              onClick={() => setFilterOpen(true)}
            >
              <PlusIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <FilterChips
            defs={defs ?? []}
            filters={filters}
            onRemove={(key) => changeFilters(filters.filter((f) => f.key !== key))}
            onClearAll={() => changeFilters([])}
          />
        </div>
        <FilterDialog
          open={filterOpen}
          onOpenChange={setFilterOpen}
          defs={defs ?? []}
          existingKeys={filters.map((f) => f.key)}
          onConfirm={(filter) => changeFilters([...filters, filter])}
        />
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
          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
