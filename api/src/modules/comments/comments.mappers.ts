import type { Comment, NewComment } from '@/db/schema';
import type { CommentDto, CreateCommentInput } from './comments.types';

/** DB row → API DTO (camelCase, ISO timestamps; createdBy exposed once auth lands). */
export function toCommentDto(comment: Comment): CommentDto {
  return {
    id: comment.id,
    userId: comment.userId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

/** API create input + target user → DB insert row. */
export function toDbInsert(userId: number, input: CreateCommentInput): NewComment {
  return {
    userId,
    content: input.content,
  };
}
