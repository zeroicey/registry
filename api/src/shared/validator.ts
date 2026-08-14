import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
import { AppError } from './errors';
import { Msg } from './messages';

/** Normalizes a ZodError into the `error` payload (works for zod v3 & v4). */
function zodIssues(error: { issues?: unknown; errors?: unknown }): unknown {
  return error.issues ?? error.errors;
}

/**
 * Shared zod-validator wrapper — the ONLY way routes validate input.
 * A failed validation converts the ZodError into AppError(VALIDATION, 400,
 * issues), which the global onError renders as the unified error envelope.
 */
export const validator = {
  json: <T extends ZodType>(schema: T) =>
    zValidator('json', schema, (result) => {
      if (!result.success) {
        throw new AppError('VALIDATION', Msg.VALIDATION_ERROR, 400, zodIssues(result.error));
      }
    }),

  query: <T extends ZodType>(schema: T) =>
    zValidator('query', schema, (result) => {
      if (!result.success) {
        throw new AppError('VALIDATION', Msg.VALIDATION_ERROR, 400, zodIssues(result.error));
      }
    }),

  params: <T extends ZodType>(schema: T) =>
    zValidator('param', schema, (result) => {
      if (!result.success) {
        throw new AppError('VALIDATION', Msg.VALIDATION_ERROR, 400, zodIssues(result.error));
      }
    }),
};
