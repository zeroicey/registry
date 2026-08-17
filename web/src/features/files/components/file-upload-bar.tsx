import { UploadIcon } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

interface FileUploadBarProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploadBar({ onFilesSelected, disabled }: FileUploadBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) onFilesSelected(files);
        }}
      />
      <Button disabled={disabled} onClick={() => inputRef.current?.click()}>
        <UploadIcon className="size-4" />
        上传附件
      </Button>
    </div>
  );
}
