import type { z } from 'zod';
import type { AttributeConfig, AttributeType } from '@/db/schema';
import type {
  attributeParamsSchema,
  createAttributeSchema,
  listAttributesQuerySchema,
  updateAttributeSchema,
} from './attributes.schema';

export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;
export type ListAttributesQuery = z.infer<typeof listAttributesQuerySchema>;
export type AttributeParams = z.infer<typeof attributeParamsSchema>;

export interface AttributeDto {
  id: number;
  key: string;
  label: string;
  type: AttributeType;
  config: AttributeConfig;
  /** null = 全局共享属性；数字 = 名录专属属性。 */
  collectionId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
