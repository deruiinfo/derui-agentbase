import type { FastifyInstance } from 'fastify';

/** 审计日志导出（CSV，仅管理员） */
export function registerExport(app: FastifyInstance): void {
  app.get(
    '/api/export/operation-logs.csv',
    { preHandler: [app.rlsKit.authenticate] },
    async (req, reply) => {
      if (app.rlsKit.ctx(req).role_type !== 'tenant_admin') {
        return reply.code(403).send({ code: 403, msg: '仅管理员可导出操作日志', data: null });
      }
      const rows = await app.rlsKit.withContext(req, async (c) => {
        const r = await c.query(
          `select operate_type, source_type, source_id, operate_user_id, created_at
           from public.operation_log order by created_at desc limit 5000`,
        );
        return r.rows;
      });
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = 'operate_type,source_type,source_id,operate_user_id,created_at';
      const body = rows
        .map((r) =>
          [r.operate_type, r.source_type, r.source_id, r.operate_user_id, r.created_at].map(esc).join(','),
        )
        .join('\n');
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="operation-logs.csv"')
        .send('\uFEFF' + header + '\n' + body);
    },
  );
}
