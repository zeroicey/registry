import { z } from 'zod';
import type { AttributeConfig, AttributeType } from '@/db/schema';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict calendar-date check — rejects impossible dates like 2025-02-30. */
function isRealDate(value: string): boolean {
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/**
 * Builds the Zod validator for an attribute VALUE from its type + config.
 * This is the single place where `attributes.config` rules are enforced:
 *   string → z.string() + min/max length + regex
 *   number → z.number() (strict JSON number, no coercion) + min/max bounds
 *   bool   → z.boolean()
 *   date   → strict YYYY-MM-DD calendar date
 *   select → one of config.options
 */
export function buildValueValidator(type: AttributeType, config: AttributeConfig): z.ZodType {
  switch (type) {
    case 'string': {
      let schema: z.ZodString = z.string();
      if (config.min !== undefined) schema = schema.min(config.min);
      if (config.max !== undefined) schema = schema.max(config.max);
      if (config.regex !== undefined) schema = schema.regex(new RegExp(config.regex));
      return schema;
    }
    case 'number': {
      let schema: z.ZodNumber = z.number();
      if (config.min !== undefined) schema = schema.gte(config.min);
      if (config.max !== undefined) schema = schema.lte(config.max);
      return schema;
    }
    case 'bool':
      return z.boolean();
    case 'date':
      return z.string().refine(isRealDate, 'must be a real date in YYYY-MM-DD format');
    case 'select': {
      const options = config.options ?? [];
      return z
        .string()
        .refine(
          (v) => options.includes(v),
          `must be one of the configured options: ${options.join(', ')}`,
        );
    }
  }
}
