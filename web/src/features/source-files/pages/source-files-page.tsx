import { useState } from 'react';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import { PageLoading } from '@/app/layout/page-loading';
import { copyText } from '@/lib/clipboard';
import { scopeToCollectionId, useCollectionStore } from '@/stores/collection-store';
import { SourceFileList, type UploadingFileRow } from '../components/source-file-list';
import { SourceFileUploadBar } from '../components/source-file-upload-bar';
import { buildImportPrompt } from '../import-prompt';
import { useDownloadSourceFile, useSourceFiles, useUploadSourceFile } from '../queries';
import type { SourceFileDto } from '../types';

const PAGE_SIZE = 20;
let nextUploadId = 0;

function createUploadId(): string {
  nextUploadId += 1;
  return `upload-${Date.now()}-${nextUploadId}`;
}

export function SourceFilesPage() {
  const scope = useCollectionStore((s) => s.scope);
  const collectionId = scopeToCollectionId(scope);
  const noCollectionSelected = collectionId === undefined;
  const [page, setPage] = useState(1);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileRow[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | undefined>();

  const { data, isLoading, isError, error } = useSourceFiles({
    page,
    pageSize: PAGE_SIZE,
    ...(collectionId !== undefined ? { collectionId } : {}),
  });
  const uploadMutation = useUploadSourceFile();
  const downloadMutation = useDownloadSourceFile();

  const uploadFiles = async (files: File[]) => {
    if (noCollectionSelected) {
      toast.error('请先在顶部选择一个名录再上传');
      return;
    }
    const rows = files.map((file) => ({
      id: createUploadId(),
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
    }));
    setUploadingFiles((current) => [...rows, ...current]);

    // Serialize uploads — source files are few and large, so one at a time is
    // enough and keeps peak memory bounded.
    let succeeded = 0;
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const row = rows[i];
      if (!file || !row) continue;
      try {
        await uploadMutation.mutateAsync({ file, collectionId });
        succeeded += 1;
        setUploadingFiles((current) => current.filter((item) => item.id !== row.id));
      } catch (err) {
        setUploadingFiles((current) =>
          current.map((item) =>
            item.id === row.id
              ? { ...item, status: 'failed' as const, error: toDisplayError(err) }
              : item,
          ),
        );
      }
    }
    if (succeeded > 0) toast.success(`已上传 ${succeeded} 个数据文件`);
  };

  const downloadFile = async (file: SourceFileDto) => {
    setDownloadingId(file.id);
    try {
      await downloadMutation.mutateAsync(file);
    } finally {
      setDownloadingId(undefined);
    }
  };

  const copyPrompt = async (file: SourceFileDto) => {
    try {
      await copyText(buildImportPrompt(file));
      toast.success('导入提示词已复制，去 CodeX / Cloud Code 粘贴即可');
    } catch {
      toast.error('复制失败，请手动复制');
    }
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
      <div>
        <h1 className="text-xl font-semibold">数据源</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          上传数据文件（Excel / CSV），交给外部 AI 导入数据库并完成溯源标记。
        </p>
      </div>
      <SourceFileUploadBar
        onFilesSelected={uploadFiles}
        disabled={uploadMutation.isPending}
        requiresCollection={noCollectionSelected}
      />
      <SourceFileList
        files={items}
        uploadingFiles={uploadingFiles}
        total={data?.total ?? 0}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onDownload={downloadFile}
        onCopyPrompt={copyPrompt}
        onDismissUpload={(uploadId) =>
          setUploadingFiles((current) => current.filter((item) => item.id !== uploadId))
        }
        downloadingId={downloadingId}
      />
    </div>
  );
}
