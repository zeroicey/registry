import { FileQuestionIcon } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <FileQuestionIcon className="size-12 text-muted-foreground/60" aria-hidden="true" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">404 · 页面不存在</h1>
        <p className="mt-2 text-muted-foreground">你访问的页面不存在或已被移动。</p>
      </div>
      <Link to="/" className={buttonVariants()}>
        返回首页
      </Link>
    </div>
  );
}
