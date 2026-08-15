/**
 * Shared attribute domain types — consumed by the dynamic form engine
 * (`components/common/attribute-form`) and both `attributes` / `users`
 * features. Lives here (not inside a feature) so components never import
 * from `features/*`.
 *
 * Mirrors the backend contract (api/src/modules/attributes/attributes.types.ts
 * + api/src/db/schema.ts).
 */

export type AttributeType = 'string' | 'number' | 'bool' | 'date' | 'select';

/** Validation & form rules carried by `attributes.config` (JSONB). */
export interface AttributeConfig {
  /** Field must be present on the user profile. */
  required?: boolean;
  /** Form rendering order (ascending). */
  sortOrder?: number;
  /** Form group/category label. */
  group?: string;
  /** Allowed values for `select` type — required when type=select. */
  options?: string[];
  /** Inclusive bounds: `number` → numeric bounds; `string` → min/max length. */
  min?: number;
  max?: number;
  /** Pattern for `string` values (ECMAScript regex). */
  regex?: string;
  /** Default value shown when the field is unset (metadata only). */
  default?: unknown;
  /** Help text shown in the form. */
  help?: string;
}

/** A configured attribute definition (backend `AttributeDto`). */
export interface AttributeDef {
  id: number;
  key: string;
  label: string;
  type: AttributeType;
  config: AttributeConfig;
  createdAt: string;
  updatedAt: string;
}
