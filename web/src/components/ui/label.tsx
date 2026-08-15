import { Field } from '@base-ui/react/field';
import { cn } from '@/lib/utils';

/** Form field label (base-ui Field.Label) — pairs with any control. */
function Label({ className, ...props }: Field.Label.Props) {
  return (
    <Field.Label
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
