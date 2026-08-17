import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import { PageLoading } from '@/app/layout/page-loading';
import { DeleteFileDialog } from '../components/delete-file-dialog';
import { FileList, type UploadingFileRow } from '../components/file-list';
import { FileUploadBar } from '../components/file-upload-bar';
import { useDeleteFile, useDownloadFile, useFiles, useUploadFile } from '../queries';
import type { FileDto } from '../types';

const PAGE_SIZE = 20;

export function UserFilesTab() {
  const { id } = useParams();
  const userId = Number(id);
  const [page, setPage] = useState(1);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileRow[]>([]);
  const [deleting, setDeleting] = useState<FileDto | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | undefined>();

  const { data, isLoading, isError, error } = useFiles(userId, {
    page,
    pageSize: PAGE_SIZE,
  });
  const uploadMutation = useUploadFile(userId);
  const deleteMutation = useDeleteFile(userId);
  const downloadMutation = useDownloadFile();

  const uploadFiles = async (files: File[]) => {
    const rows = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
    }));
    setUploadingFiles((current) => [...rows, ...current]);

    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        const row = rows[index];
        if (!row) return;
        try {
          await uploadMutation.mutateAsync(file);
          setUploadingFiles((current) => current.filter((item) => item.id !== row.id));
          return { ok: true };
        } catch (err) {
          setUploadingFiles((current) =>
            current.map((item) =>
              item.id === row.id
                ? { ...item, status: 'failed' as const, error: toDisplayError(err) }
                : item,
            ),
          );
          return { ok: false };
        }
      }),
    );

    const succeeded = results.filter(
      (result) => result.status === 'fulfilled' && result.value?.ok === true,
    ).length;
    if (succeeded > 0) toast.success(`已上传 ${succeeded} 个附件`);
  };

  const downloadFile = async (file: FileDto) => {
    setDownloadingId(file.id);
    try {
      await downloadMutation.mutateAsync(file);
    } finally {
      setDownloadingId(undefined);
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSettled: () => setDeleting(null),
    });
  };

  if (isLoading) return <PageLoading />;
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">{toDisplayError(error)}</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <FileUploadBar onFilesSelected={uploadFiles} disabled={uploadMutation.isPending} />
      <FileList
        files={items}
        uploadingFiles={uploadingFiles}
        total={data?.total ?? 0}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onDownload={downloadFile}
        onDelete={setDeleting}
        onDismissUpload={(uploadId) =>
          setUploadingFiles((current) => current.filter((item) => item.id !== uploadId))
        }
        downloadingId={downloadingId}
        isDeleting={deleteMutation.isPending}
      />
      <DeleteFileDialog
        file={deleting}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={confirmDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
