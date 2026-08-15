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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectPopup,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
}: AttributeFieldsProps<TFieldValues>) {
  const sorted = [...defs].sort((a, b) => (a.config.sortOrder ?? 0) - (b.config.sortOrder ?? 0));

  // Group fields by config.group (fields without a group render first).
  const grouped = new Map<string, AttributeDef[]>();
  for (const item of sorted) {
    const group = item.config.group ?? '';
    const bucket = grouped.get(group) ?? [];
    bucket.push(item);
    grouped.set(group, bucket);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...grouped.entries()].map(([group, items]) => (
        <fieldset key={group || '__ungrouped'} className="flex flex-col gap-3">
          {group && <legend className="text-sm font-medium text-muted-foreground">{group}</legend>}
          {items.map((item) => (
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
                  <Label htmlFor={`attr-${item.key}`}>
                    {item.label}
                    {item.config.required && (
                      <span className="ml-0.5 text-destructive" aria-hidden="true">
                        *
                      </span>
                    )}
                  </Label>
                  {renderControl(item, field)}
                  {item.config.help && (
                    <p className="text-xs text-muted-foreground">{item.config.help}</p>
                  )}
                  <FieldError message={errors?.[item.key]?.message} />
                </div>
              )}
            />
          ))}
        </fieldset>
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
            {item.config.group ? (
              <SelectGroup>
                <SelectLabel>{item.label}</SelectLabel>
                {(item.config.options ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : (
              (item.config.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))
            )}
          </SelectPopup>
        </SelectRoot>
      );
  }
}
