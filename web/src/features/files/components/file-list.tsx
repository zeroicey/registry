import { DownloadIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import type { FileDto } from '../types';

export interface UploadingFileRow {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'failed';
  error?: string;
}

interface FileListProps {
  files: FileDto[];
  uploadingFiles: UploadingFileRow[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDownload: (file: FileDto) => void;
  onDelete: (file: FileDto) => void;
  onDismissUpload: (id: string) => void;
  downloadingId?: number | undefined;
  isDeleting?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0] ?? 'KB';
  for (const nextUnit of units) {
    unit = nextUnit;
    if (value < 1024 || nextUnit === units.at(-1)) break;
    value /= 1024;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

export function FileList({
  files,
  uploadingFiles,
  total,
  page,
  totalPages,
  onPageChange,
  onDownload,
  onDelete,
  onDismissUpload,
  downloadingId,
  isDeleting,
}: FileListProps) {
  if (files.length === 0 && uploadingFiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm text-muted-foreground">暂无附件。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>文件名</TableHead>
            <TableHead className="w-24">大小</TableHead>
            <TableHead className="w-40">上传时间</TableHead>
            <TableHead className="w-28 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploadingFiles.map((file) => (
            <TableRow key={file.id} className="bg-muted/30 hover:bg-muted/30">
              <TableCell className="min-w-0 whitespace-normal py-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{file.name}</span>
                  {file.status === 'failed' ? (
                    <span className="text-xs text-destructive">{file.error ?? '上传失败'}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">上传中...</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatFileSize(file.size)}</TableCell>
              <TableCell className="text-muted-foreground">-</TableCell>
              <TableCell className="text-right">
                {file.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="移除失败记录"
                    onClick={() => onDismissUpload(file.id)}
                  >
                    <XIcon className="size-3" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}

          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="min-w-0 whitespace-normal py-2">
                <span className="break-all font-medium">{file.originalName}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatFileSize(file.size)}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(file.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={downloadingId === file.id}
                    onClick={() => onDownload(file)}
                  >
                    <DownloadIcon className="size-3" />
                    {downloadingId === file.id ? '下载中...' : '下载'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={isDeleting}
                    onClick={() => onDelete(file)}
                  >
                    <Trash2Icon className="size-3" />
                    移除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 个附件</span>
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
    </div>
  );
}
