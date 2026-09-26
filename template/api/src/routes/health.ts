import type { FastifyInstance } from 'fastify';

export function registerHealth(app: FastifyInstance): void {
  app.get('/api/health', async () => ({ code: 200, msg: 'success', data: { ok: true } }));
}
