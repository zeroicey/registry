import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FileDto } from '../types';

interface DeleteFileDialogProps {
  file: FileDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteFileDialog({
  file,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteFileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>移除附件</DialogTitle>
          <DialogDescription>
            确定移除「{file?.originalName ?? '该附件'}」吗？移除后不会再显示在此人员档案中。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? '移除中...' : '移除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
