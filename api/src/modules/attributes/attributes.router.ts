import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  createAttributeHandler,
  deleteAttributeHandler,
  getAttributeHandler,
  listAttributesHandler,
  updateAttributeHandler,
} from './attributes.handler';
import {
  attributeParamsSchema,
  createAttributeSchema,
  listAttributesQuerySchema,
  updateAttributeSchema,
} from './attributes.schema';

/** RESTful attribute routes — every route validates via the shared validator. */
export const attributesRouter = new Hono();

attributesRouter
  .get('/', validator.query(listAttributesQuerySchema), listAttributesHandler)
  .post('/', validator.json(createAttributeSchema), createAttributeHandler)
  .get('/:id', validator.params(attributeParamsSchema), getAttributeHandler)
  .patch(
    '/:id',
    validator.params(attributeParamsSchema),
    validator.json(updateAttributeSchema),
    updateAttributeHandler,
  )
  .delete('/:id', validator.params(attributeParamsSchema), deleteAttributeHandler);
