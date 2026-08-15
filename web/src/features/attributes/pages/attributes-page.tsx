import { PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
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
import type { AttributeDef } from '@/types/attribute';
import { AttributeFormDialog } from '../components/attribute-form-dialog';
import { AttributesTable } from '../components/attributes-table';
import { useAttributeDefs, useDeleteAttribute } from '../queries';

/** 属性配置页：属性定义列表 + 新建/编辑弹窗 + 删除确认。 */
export function AttributesPage() {
  const { data: attributes, isLoading, isError, refetch } = useAttributeDefs();
  const deleteMutation = useDeleteAttribute();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttributeDef | undefined>(undefined);
  const [deleting, setDeleting] = useState<AttributeDef | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (attribute: AttributeDef) => {
    setEditing(attribute);
    setFormOpen(true);
  };

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
          <h1 className="text-xl font-semibold tracking-tight">自定义属性</h1>
          <p className="text-sm text-muted-foreground">
            定义人员档案的自定义字段，类型与校验规则会同步到人员表单。
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          新建属性
        </Button>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <SlidersHorizontalIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">属性加载失败</p>
          <Button variant="outline" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      ) : attributes !== undefined && attributes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <SlidersHorizontalIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">还没有自定义属性，点击右上角新建。</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <AttributesTable attributes={attributes ?? []} onEdit={openEdit} onDelete={setDeleting} />
        </div>
      )}

      <AttributeFormDialog open={formOpen} onOpenChange={setFormOpen} attribute={editing} />

      <Dialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除属性</DialogTitle>
            <DialogDescription>
              确定删除「{deleting?.label ?? ''}
              」吗？该操作不可撤销；若属性已有人员填写值，删除会被拒绝。
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
