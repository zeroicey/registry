import { z } from 'zod';

/** Business key format: lowercase letters/digits/underscores, must not start with a digit. */
export const attributeKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'key must start with a lowercase letter and contain only lowercase letters, digits and underscores',
  );

export const attributeTypeSchema = z.enum(['string', 'number', 'bool', 'date', 'select']);

/** Validation & form rules carried by attributes.config. */
const baseConfigSchema = z.object({
  sortOrder: z.number().int().optional(),
  /** Allowed values for `select` type — required when type=select. */
  options: z.array(z.string().min(1).max(200)).min(1).optional(),
  /** Inclusive bounds: `number` → numeric bounds; `string` → min/max length. */
  min: z.number().optional(),
  max: z.number().optional(),
  /** Pattern for `string` values (ECMAScript regex). */
  regex: z.string().max(256).optional(),
  /** Default value shown when the field is unset (metadata only). */
  default: z.unknown().optional(),
  help: z.string().max(256).optional(),
});

export const attributeConfigSchema = baseConfigSchema.superRefine((config, ctx) => {
  if (config.options !== undefined && new Set(config.options).size !== config.options.length) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be unique' });
  }
  if (config.min !== undefined && config.max !== undefined && config.max < config.min) {
    ctx.addIssue({
      code: 'custom',
      path: ['max'],
      message: 'max must be greater than or equal to min',
    });
  }
  if (config.regex !== undefined) {
    try {
      new RegExp(config.regex);
    } catch {
      ctx.addIssue({ code: 'custom', path: ['regex'], message: 'regex must be a valid pattern' });
    }
  }
});

/** Cross-field rule: select attributes must declare options. */
function refineSelectHasOptions(
  data: {
    type?: z.infer<typeof attributeTypeSchema> | undefined;
    config?: { options?: string[] | undefined } | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.type === 'select' &&
    (data.config?.options === undefined || data.config.options.length === 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['config', 'options'],
      message: 'options are required for select attributes',
    });
  }
}

export const createAttributeSchema = z
  .object({
    key: attributeKeySchema,
    label: z.string().min(1).max(100),
    type: attributeTypeSchema,
    config: attributeConfigSchema.default({}),
    /** 归属名录：null/缺省 = 全局共享属性；数字 = 名录专属属性。创建后不可迁移。 */
    collectionId: z.number().int().positive().nullable().optional(),
  })
  .superRefine(refineSelectHasOptions);

export const updateAttributeSchema = z
  .object({
    label: z.string().min(1).max(100),
    type: attributeTypeSchema,
    config: attributeConfigSchema,
  })
  .partial()
  .superRefine(refineSelectHasOptions);

export const attributeListScopeSchema = z.enum(['all', 'global', 'collection']);

export const listAttributesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    /** all=全部；global=仅全局；collection=全局∪指定名录。 */
    scope: attributeListScopeSchema.default('all'),
    collectionId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((query, ctx) => {
    if (query.scope === 'collection' && query.collectionId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['collectionId'],
        message: 'collectionId is required when scope=collection',
      });
    }
  });

export const attributeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
