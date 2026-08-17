import { Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toDisplayError } from '@/api/errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchFileContent } from '../api';
import type { FileDto } from '../types';

interface FilePreviewDialogProps {
  file: FileDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Attachment preview dialog. Only images are previewable for now: the file's
 * `mimeType` decides whether to fetch and render an <img>, or show a fallback
 * hint. Content is fetched as a Blob and shown through an object URL (the
 * content endpoint forces Content-Disposition: attachment, which is wrong for
 * inline display); the URL is revoked when the dialog closes or the file swaps.
 */
export function FilePreviewDialog({ file, open, onOpenChange }: FilePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = file?.mimeType.startsWith('image/') ?? false;

  useEffect(() => {
    setUrl(null);
    setError(null);

    if (!open || !file || !isImage) {
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);

    fetchFileContent(file.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toDisplayError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, open, isImage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>预览附件</DialogTitle>
          <DialogDescription className="break-all">{file?.originalName}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-40 items-center justify-center">
          {!isImage && (
            <p className="text-sm text-muted-foreground">
              该文件类型暂不支持预览，请使用「下载」查看。
            </p>
          )}
          {isImage && loading && (
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          )}
          {isImage && !loading && error && <p className="text-sm text-destructive">{error}</p>}
          {isImage && !loading && !error && url && (
            <img
              src={url}
              alt={file?.originalName ?? '预览图'}
              className="max-h-[70vh] max-w-full rounded-md object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
