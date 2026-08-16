import type { Attribute, AttributeConfig, AttributeValue } from '@/db/schema';
import type { AttributeDto, CreateAttributeInput, UpdateAttributeInput } from './attributes.types';

/** DB row → API DTO (camelCase, ISO timestamps). */
export function toDto(attr: Attribute): AttributeDto {
  return {
    id: attr.id,
    key: attr.key,
    label: attr.label,
    type: attr.type,
    config: attr.config,
    createdAt: attr.createdAt.toISOString(),
    updatedAt: attr.updatedAt.toISOString(),
  };
}

/**
 * Zod's optional() output types (`sortOrder?: number | undefined`) are not
 * assignable to the AttributeConfig interface under exactOptionalPropertyTypes,
 * so the structurally-identical value is cast here, at the boundary.
 */
function toDbConfig(
  config: CreateAttributeInput['config'] | UpdateAttributeInput['config'],
): AttributeConfig {
  return config as AttributeConfig;
}

/** API create input → DB insert row. */
export function toDbInsert(input: CreateAttributeInput) {
  return {
    key: input.key,
    label: input.label,
    type: input.type,
    config: toDbConfig(input.config),
  };
}

/** API update input → DB update slice (only present fields). */
export function toDbUpdate(input: UpdateAttributeInput) {
  return {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.config !== undefined ? { config: toDbConfig(input.config) } : {}),
  };
}

/** Type guard for attribute_values rows joined with attribute metadata. */
export interface AssembledValue {
  attributeId: number;
  key: string;
  label: string;
  type: Attribute['type'];
  value: AttributeValue['value'];
  updatedAt: Date;
}
