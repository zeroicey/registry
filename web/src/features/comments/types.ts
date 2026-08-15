/** API-facing comment shape — mirrors api/src/modules/comments/comments.types.ts. */
export interface CommentDto {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListCommentsParams {
  page: number;
  pageSize: number;
}
