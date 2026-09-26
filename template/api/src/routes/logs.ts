import type { FastifyInstance } from 'fastify';

export function registerLogs(app: FastifyInstance): void {
  app.get(
    '/api/operation-logs',
    { preHandler: [app.rlsKit.authenticate] },
    async (req, reply) => {
      if (app.rlsKit.ctx(req).role_type !== 'tenant_admin') {
        return reply.code(403).send({ code: 403, msg: '仅管理员可查看操作日志', data: null });
      }
      const q = (req.query ?? {}) as Record<string, string>;
      const page = Math.max(1, Number(q.page || 1));
      const pageSize = Math.min(100, Math.max(1, Number(q.page_size || 20)));
      const offset = (page - 1) * pageSize;

      const result = await app.rlsKit.withContext(req, async (c) => {
        const total = await c.query<{ n: string }>('select count(*)::int as n from public.operation_log');
        const list = await c.query(
          `select id, operate_user_id, operate_type, source_type, source_id, created_at
           from public.operation_log order by created_at desc limit $1 offset $2`,
          [pageSize, offset],
        );
        return { total: Number(total.rows[0]?.n ?? 0), list: list.rows };
      });
      return { code: 200, msg: 'success', data: result };
    },
  );
}
