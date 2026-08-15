import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Form field label (shadcn style) — a plain <label> that pairs with any
 * control via htmlFor. Not base-ui Field.Label: that part requires a
 * <Field.Root> ancestor, which none of our RHF-driven forms provide.
 */
function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: wrapper component - callers associate via htmlFor
    <label
      data-slot="label"
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
