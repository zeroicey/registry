export interface SourceFileDto {
  id: number;
  originalName: string;
  mimeType: string;
  size: number;
  /** uploaded = 已上传未导入；imported = 已由外部 AI 导入并完成溯源标记。 */
  status: 'uploaded' | 'imported';
  createdAt: string;
}

export interface ListSourceFilesParams {
  page: number;
  pageSize: number;
}
