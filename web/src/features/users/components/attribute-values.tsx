import type { AttributeDef } from '@/types/attribute';

/** 只读值：bool → 是/否，空值 → —，其余按原样展示。 */
function formatValue(def: AttributeDef, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (def.type === 'bool') return value === true ? '是' : '否';
  return String(value);
}

/**
 * 属性只读展示：按属性定义（sortOrder）排序的响应式网格，
 * 移动端一列，宽屏多列。
 */
export function AttributeValues({
  defs,
  profile,
}: {
  defs: AttributeDef[];
  profile: Record<string, unknown>;
}) {
  const sorted = [...defs].sort((a, b) => (a.config.sortOrder ?? 0) - (b.config.sortOrder ?? 0));

  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((item) => (
        <div key={item.key} className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-sm font-medium">{formatValue(item, profile[item.key])}</dd>
        </div>
      ))}
    </dl>
  );
}
