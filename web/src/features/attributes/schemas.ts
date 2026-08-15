import { z } from 'zod';
import type { AttributeConfig, AttributeDef, AttributeType } from '@/types/attribute';

/** Business key format — mirrors the backend (api/src/modules/attributes/attributes.schema.ts). */
export const attributeKeySchema = z
  .string()
  .trim()
  .min(1, '请输入属性 key')
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, '以小写字母开头，仅含小写字母、数字与下划线');

export const attributeTypeSchema = z.enum(['string', 'number', 'bool', 'date', 'select']);

/** Optional text field that must be a valid number when non-empty. */
const optionalNumberString = z
  .string()
  .refine((value) => value === '' || !Number.isNaN(Number(value)), '请输入数字');

/** Parse the options textarea (one option per line) into a trimmed array. */
export function parseOptions(raw: string | undefined): string[] {
  return (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Flat react-hook-form shape — config fields are lifted to the top level so
 * the dialog renders them directly. Submitted via toCreateInput/toUpdateInput.
 */
export const attributeFormSchema = z
  .object({
    key: attributeKeySchema,
    label: z.string().trim().min(1, '请输入名称').max(100, '名称最长 100 字'),
    type: attributeTypeSchema,
    // --- generic config (all types) ---
    required: z.boolean(),
    group: z.string().trim().max(64, '分组最长 64 字').optional(),
    sortOrder: optionalNumberString.optional(),
    help: z.string().trim().max(256, '帮助文本最长 256 字').optional(),
    // --- type-specific config ---
    optionsRaw: z.string().optional(), // select: one option per line
    min: optionalNumberString.optional(), // number min / string min length
    max: optionalNumberString.optional(), // number max / string max length
    regex: z.string().trim().max(256).optional(), // string pattern
  })
  .superRefine((data, ctx) => {
    if (data.type === 'select') {
      const options = parseOptions(data.optionsRaw);
      if (options.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['optionsRaw'],
          message: '下拉类型至少需要一个选项',
        });
      } else if (new Set(options).size !== options.length) {
        ctx.addIssue({ code: 'custom', path: ['optionsRaw'], message: '选项不能重复' });
      }
    }
    if (data.min !== undefined && data.max !== undefined && Number(data.max) < Number(data.min)) {
      ctx.addIssue({ code: 'custom', path: ['max'], message: '最大值不能小于最小值' });
    }
    if (data.regex) {
      try {
        new RegExp(data.regex);
      } catch {
        ctx.addIssue({ code: 'custom', path: ['regex'], message: '正则表达式无效' });
      }
    }
  });

export type AttributeFormValues = z.infer<typeof attributeFormSchema>;

export interface CreateAttributeInput {
  key: string;
  label: string;
  type: AttributeType;
  config: AttributeConfig;
}

export interface UpdateAttributeInput {
  label: string;
  type: AttributeType;
  config: AttributeConfig;
}

/** Assemble the create payload from flat form values (empty config fields dropped). */
export function toCreateInput(values: AttributeFormValues): CreateAttributeInput {
  return {
    key: values.key,
    label: values.label,
    type: values.type,
    config: toConfig(values),
  };
}

/** Assemble the update payload — key is immutable after creation (backend PATCH has no key). */
export function toUpdateInput(values: AttributeFormValues): UpdateAttributeInput {
  return {
    label: values.label,
    type: values.type,
    config: toConfig(values),
  };
}

function toConfig(values: AttributeFormValues): AttributeConfig {
  const config: AttributeConfig = {};
  if (values.required) config.required = true;
  if (values.group) config.group = values.group;
  if (values.sortOrder) config.sortOrder = Number(values.sortOrder);
  if (values.help) config.help = values.help;

  switch (values.type) {
    case 'select':
      config.options = parseOptions(values.optionsRaw);
      break;
    case 'number':
      if (values.min) config.min = Number(values.min);
      if (values.max) config.max = Number(values.max);
      break;
    case 'string':
      if (values.max) config.max = Number(values.max); // max length
      if (values.regex) config.regex = values.regex;
      break;
    default:
      break;
  }
  return config;
}

/** Prefill form values from an existing attribute definition (edit mode). */
export function toFormValues(attribute: AttributeDef): AttributeFormValues {
  return {
    key: attribute.key,
    label: attribute.label,
    type: attribute.type,
    required: attribute.config.required ?? false,
    group: attribute.config.group ?? '',
    sortOrder: attribute.config.sortOrder?.toString() ?? '',
    help: attribute.config.help ?? '',
    optionsRaw: (attribute.config.options ?? []).join('\n'),
    min: attribute.config.min?.toString() ?? '',
    max: attribute.config.max?.toString() ?? '',
    regex: attribute.config.regex ?? '',
  };
}
