import type { FastifyInstance } from 'fastify';
import { db } from '../db.ts';

/** 登录日志（仅管理员；表启用 RLS 且无策略 → 走超管连接） */
export function registerLoginLogs(app: FastifyInstance): void {
  app.get('/api/login-logs', { preHandler: [app.rlsKit.authenticate] }, async (req, reply) => {
    if (app.rlsKit.ctx(req).role_type !== 'tenant_admin') {
      return reply.code(403).send({ code: 403, msg: '仅管理员可查看登录日志', data: null });
    }
    const q = (req.query ?? {}) as Record<string, string>;
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.page_size || 20)));
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];
    if (q.result) {
      params.push(q.result);
      where.push(`result = $${params.length}`);
    }
    if (q.account) {
      params.push(`%${q.account}%`);
      where.push(`login_account ilike $${params.length}`);
    }
    const w = where.length ? `where ${where.join(' and ')}` : '';

    const total = await db.adminPool.query<{ n: string }>(
      `select count(*)::int as n from public.login_log ${w}`,
      params,
    );
    const list = await db.adminPool.query(
      `select id, login_account, result, ip_address, user_agent, created_at
       from public.login_log ${w} order by created_at desc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, pageSize, offset],
    );
    return {
      code: 200,
      msg: 'success',
      data: { total: Number(total.rows[0]?.n ?? 0), list: list.rows },
    };
  });
}
