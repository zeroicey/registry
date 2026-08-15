import { useState } from 'react';
import { useParams } from 'react-router';
import { toDisplayError } from '@/api/errors';
import { PageLoading } from '@/app/layout/page-loading';
import { CommentForm } from '../components/comment-form';
import { CommentList } from '../components/comment-list';
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from '../queries';
import type { CreateCommentInput } from '../schemas';

const PAGE_SIZE = 20;

/** 留言 Tab：留言流 + 底部输入框，挂载于 /users/:id/comments。 */
export function CommentsTab() {
  const { id } = useParams();
  const userId = Number(id);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useComments(userId, { page, pageSize: PAGE_SIZE });
  const createMutation = useCreateComment(userId);
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const submit = (input: CreateCommentInput) => createMutation.mutate(input);

  if (isLoading) return <PageLoading />;
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{toDisplayError(error)}</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <CommentList
        comments={items}
        total={data?.total ?? 0}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onUpdate={(commentId, content) =>
          updateMutation.mutate({ id: commentId, userId, input: { content } })
        }
        onDelete={(commentId) => deleteMutation.mutate({ id: commentId, userId })}
        isUpdating={isMutating}
      />
      <CommentForm userId={userId} onSubmit={submit} isPending={createMutation.isPending} />
    </div>
  );
}
