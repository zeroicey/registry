import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MiddlewareHandler } from 'hono';
import { pinoHttp } from 'pino-http';
import { logger } from '@/shared/logger';
import { security } from './security';

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err !== undefined || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req) => req.url?.includes('/health') ?? false,
  },
});

/**
 * pino-http expects Node.js IncomingMessage/ServerResponse with 'finish'
 * events, but Bun serves web-standard Request/Response. This adapter feeds
 * pino-http minimal stand-ins and emits 'finish' once the Hono chain has
 * produced the final response, so request/response logs keep working.
 * (The double cast is required at this Node↔Web adapter boundary.)
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headersSent: true,
    writableEnded: true,
    getHeaders: () => ({}),
  }) as unknown as ServerResponse;

  await new Promise<void>((resolve) => {
    httpLogger(c.req.raw as unknown as IncomingMessage, res, resolve);
  });

  await next();

  res.statusCode = c.res.status;
  res.emit('finish');
};

export { security };
