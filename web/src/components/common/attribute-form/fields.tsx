import {
  type Control,
  Controller,
  type ControllerRenderProps,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SelectItem,
  SelectPopup,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AttributeDef } from '@/types/attribute';

interface AttributeFieldsProps<TFieldValues extends FieldValues> {
  /** Attribute definitions driving the rendered fields (already filtered/sorted upstream if needed). */
  defs: AttributeDef[];
  /** react-hook-form control over the form that hosts the profile fields. */
  control: Control<TFieldValues>;
  /** Field errors keyed by attribute key (already scoped to the prefix when set). */
  errors?: FieldErrors<Record<string, unknown>> | undefined;
  /**
   * Optional field-path prefix, e.g. `profile` binds each field to `profile.<key>`.
   * Leave unset when the form value IS the flat profile object.
   */
  namePrefix?: string;
  /** Extra classes for the field list container — pass a grid to arrange fields in columns. */
  className?: string;
}

function asString(value: unknown): string {
  // number inputs hold string values; pre-filled numeric profiles arrive as numbers.
  return value === undefined || value === null ? '' : String(value);
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/**
 * Pure controlled field list rendered from attribute definitions — shared by
 * the create-user dialog, the profile tab and the list filter bar. Field
 * value types follow the backend contract: string / number / bool / date
 * (YYYY-MM-DD) / select.
 */
export function AttributeFields<TFieldValues extends FieldValues>({
  defs,
  control,
  errors,
  namePrefix,
  className,
}: AttributeFieldsProps<TFieldValues>) {
  const sorted = [...defs].sort((a, b) => (a.config.sortOrder ?? 0) - (b.config.sortOrder ?? 0));

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {sorted.map((item) => (
        <Controller<TFieldValues>
          key={item.key}
          name={
            (namePrefix
              ? `${namePrefix}.${item.key}`
              : item.key) as unknown as FieldPath<TFieldValues>
          }
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`attr-${item.key}`}>{item.label}</Label>
              {renderControl(item, field)}
              {item.config.help && (
                <p className="text-xs text-muted-foreground">{item.config.help}</p>
              )}
              <FieldError message={errors?.[item.key]?.message} />
            </div>
          )}
        />
      ))}
    </div>
  );
}

function renderControl<TFieldValues extends FieldValues>(
  item: AttributeDef,
  field: ControllerRenderProps<TFieldValues>,
) {
  const inputId = `attr-${item.key}`;
  const common = { id: inputId, name: field.name, onBlur: field.onBlur, ref: field.ref };

  switch (item.type) {
    case 'string':
      return (
        <Input
          {...common}
          value={asString(field.value)}
          onChange={(event) => field.onChange(event.target.value)}
        />
      );
    case 'number':
      return (
        <Input
          {...common}
          type="number"
          step="any"
          value={asString(field.value)}
          onChange={(event) => field.onChange(event.target.value)}
        />
      );
    case 'date':
      return (
        <Input
          {...common}
          type="date"
          value={asString(field.value)}
          onChange={(event) => field.onChange(event.target.value)}
        />
      );
    case 'bool':
      return (
        <Switch
          checked={field.value === true}
          onCheckedChange={(checked) => field.onChange(checked)}
        />
      );
    case 'select':
      return (
        <SelectRoot
          value={asString(field.value)}
          onValueChange={(value) => field.onChange(value)}
          name={field.name}
        >
          <SelectTrigger id={inputId}>
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectPopup>
            {(item.config.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectPopup>
        </SelectRoot>
      );
  }
}
