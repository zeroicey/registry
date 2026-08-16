import { z } from 'zod';
import type { AttributeConfig, AttributeDef, AttributeType } from '@/types/attribute';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict calendar-date check — rejects impossible dates like 2025-02-30. */
function isRealDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Normalize an empty form input to `undefined` so optional fields can be left
 * blank. `false` is a valid bool value and is preserved.
 */
function emptyToUndefined(value: unknown): unknown {
  return value === '' || value === null || value === undefined ? undefined : value;
}

/** Build the Zod validator for a single attribute value from type + config. */
export function buildValueSchema(type: AttributeType, config: AttributeConfig): z.ZodType {
  switch (type) {
    case 'string': {
      let schema: z.ZodString = z.string();
      if (config.min !== undefined) schema = schema.min(config.min, `至少 ${config.min} 个字符`);
      if (config.max !== undefined) schema = schema.max(config.max, `最多 ${config.max} 个字符`);
      if (config.regex !== undefined) schema = schema.regex(new RegExp(config.regex), '格式不正确');
      return schema;
    }
    case 'number': {
      // Form inputs are strings — coerce while keeping empty input as undefined.
      let schema: z.ZodNumber = z.number('请输入数字');
      if (config.min !== undefined) schema = schema.gte(config.min, `不能小于 ${config.min}`);
      if (config.max !== undefined) schema = schema.lte(config.max, `不能大于 ${config.max}`);
      return z.preprocess((value) => {
        const normalized = emptyToUndefined(value);
        return normalized === undefined ? undefined : Number(normalized);
      }, schema);
    }
    case 'bool':
      return z.boolean();
    case 'date':
      return z.string().refine(isRealDate, '日期格式须为 YYYY-MM-DD 且为真实日期');
    case 'select': {
      const options = config.options ?? [];
      const base =
        options.length === 1
          ? z.literal(options[0])
          : z.enum(options as [string, ...string[]], {
              error: '不在允许的选项中',
            });
      return base;
    }
  }
}

/**
 * Build the Zod schema for a profile object keyed by attribute business key.
 * Every field accepts empty input (blank clears to undefined); type-specific
 * rules (min/max/regex/options) still apply when a value is present.
 * Mirrors the backend's `buildValueValidator` (api/src/modules/attributes/validation.ts).
 */
export function buildProfileSchema(defs: AttributeDef[]): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};
  for (const def of defs) {
    const schema = buildValueSchema(def.type, def.config);
    // preprocess BEFORE optional so blank input clears to undefined.
    shape[def.key] = z.preprocess(emptyToUndefined, schema.optional());
  }
  return z.object(shape);
}
