import { Hono } from 'hono';
import { healthHandler } from './health.handler';

export const healthRouter = new Hono();

healthRouter.get('/', healthHandler);
