export interface FileDto {
  id: number;
  userId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface ListFilesParams {
  page: number;
  pageSize: number;
}
