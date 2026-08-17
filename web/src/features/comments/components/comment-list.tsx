import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/datetime';
import { commentContentSchema } from '../schemas';
import type { CommentDto } from '../types';

interface CommentListProps {
  comments: CommentDto[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onUpdate: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  isUpdating?: boolean;
}

/** 留言流：时间倒序（后端已按 createdAt DESC），hover 行出现编辑/删除。 */
export function CommentList({
  comments,
  total,
  page,
  totalPages,
  onPageChange,
  onUpdate,
  onDelete,
  isUpdating,
}: CommentListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editError, setEditError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState<CommentDto | null>(null);

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm text-muted-foreground">还没有留言，来写第一条吧。</p>
      </div>
    );
  }

  const startEdit = (comment: CommentDto) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditError(undefined);
  };

  const saveEdit = (comment: CommentDto) => {
    const result = commentContentSchema.safeParse(editContent);
    if (!result.success) {
      setEditError(result.error.issues[0]?.message ?? '内容不合法');
      return;
    }
    onUpdate(comment.id, result.data);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {comments.map((comment) => {
          const isEditing = editingId === comment.id;
          return (
            <li key={comment.id} className="group border-b py-3 last:border-b-0">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    aria-invalid={Boolean(editError)}
                    autoFocus
                  />
                  {editError && <p className="text-xs text-destructive">{editError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      disabled={isUpdating}
                    >
                      <XIcon className="size-3.5" />
                      取消
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(comment)} disabled={isUpdating}>
                      <CheckIcon className="size-3.5" />
                      {isUpdating ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {comment.content}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(comment.createdAt)}
                    </span>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => startEdit(comment)}
                      >
                        <PencilIcon className="size-3" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => setDeleting(comment)}
                      >
                        <Trash2Icon className="size-3" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 条留言</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
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
              onClick={() => onPageChange(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除留言</DialogTitle>
            <DialogDescription>确定删除这条留言吗？删除后不可恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={isUpdating}
              onClick={() => {
                if (deleting) onDelete(deleting.id);
                setDeleting(null);
              }}
            >
              {isUpdating ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
