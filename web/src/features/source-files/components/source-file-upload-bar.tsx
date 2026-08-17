import { UploadIcon } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

interface SourceFileUploadBarProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  /** 未选择名录时禁止上传（来源文件必须归属某个名录）。 */
  requiresCollection?: boolean;
}

export function SourceFileUploadBar({
  onFilesSelected,
  disabled = false,
  requiresCollection = false,
}: SourceFileUploadBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,.txt"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) onFilesSelected(files);
        }}
      />
      <Button disabled={disabled || requiresCollection} onClick={() => inputRef.current?.click()}>
        <UploadIcon className="size-4" />
        上传数据文件
      </Button>
      <p className="text-xs text-muted-foreground">
        {requiresCollection
          ? '请先在顶部选择一个名录再上传'
          : '支持 Excel / CSV，上传后交给外部 AI 导入并溯源'}
      </p>
    </div>
  );
}
