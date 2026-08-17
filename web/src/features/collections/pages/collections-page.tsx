import { FolderIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from '../queries';
import type { CollectionDto } from '../types';

interface CollectionFormState {
  name: string;
  description: string;
}

const EMPTY_FORM: CollectionFormState = { name: '', description: '' };

/** 名录管理页：名录列表 + 新建/重命名/删除。 */
export function CollectionsPage() {
  const { data: collections, isLoading, isError } = useCollections();
  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection();
  const deleteMutation = useDeleteCollection();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionDto | undefined>(undefined);
  const [deleting, setDeleting] = useState<CollectionDto | undefined>(undefined);
  const [form, setForm] = useState<CollectionFormState>(EMPTY_FORM);

  const openCreate = () => {
    setEditing(undefined);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (collection: CollectionDto) => {
    setEditing(collection);
    setForm({ name: collection.name, description: collection.description ?? '' });
    setFormOpen(true);
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) return;
    const payload = {
      name,
      description: form.description.trim() === '' ? null : form.description.trim(),
    };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, input: payload },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, { onSettled: () => setDeleting(undefined) });
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">名录</h1>
          <p className="text-sm text-muted-foreground">
            每个名录对应一类人员（某校教师 / 某店客户 / 某企业员工），属性与数据源在名录内各自独立。
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          新建名录
        </Button>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <FolderIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">名录加载失败</p>
        </div>
      ) : (collections ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <FolderIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">还没有名录，点击右上角新建。</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(collections ?? []).map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">{collection.name}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {collection.description ?? '—'}
                  </TableCell>
                  <TableCell>{collection.memberCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(collection.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`编辑 ${collection.name}`}
                        onClick={() => openEdit(collection)}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`删除 ${collection.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(collection)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑名录' : '新建名录'}</DialogTitle>
            <DialogDescription>
              {editing
                ? '修改名录名称与描述。'
                : '创建一个领域实例（如「某校教师」「某店客户」）。'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-name">名称</Label>
              <Input
                id="collection-name"
                value={form.name}
                placeholder="如：某校教师"
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-description">描述（可选）</Label>
              <Input
                id="collection-description"
                value={form.description}
                placeholder="如：2026 春季教师名册"
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button
              disabled={
                form.name.trim() === '' || createMutation.isPending || updateMutation.isPending
              }
              onClick={submit}
            >
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除名录</DialogTitle>
            <DialogDescription>
              确定删除「{deleting?.name ?? ''}
              」吗？名录内属性与数据源会随之不再展示（软删除），成员关系解除，不可恢复。
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
