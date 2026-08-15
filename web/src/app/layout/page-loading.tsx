import { Loader2Icon } from 'lucide-react';

/** Route-level loading fallback for lazy pages (Suspense boundary). */
export function PageLoading() {
  return (
    <div
      role="status"
      aria-label="页面加载中"
      className="flex min-h-[40dvh] items-center justify-center"
    >
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
