import type { FastifyInstance } from 'fastify';

export function registerMe(app: FastifyInstance): void {
  app.get('/api/me', { preHandler: [app.rlsKit.authenticate] }, async (req) => {
    const ctx = app.rlsKit.ctx(req);
    const user = await app.rlsKit.withContext(req, async (c) => {
      const r = await c.query(
        'select id, user_name, login_account, role_type, user_status, two_factor_enabled from public.app_user where id = $1',
        [ctx.user_id],
      );
      return r.rows[0] ?? null;
    });
    return {
      code: 200,
      msg: 'success',
      data: {
        user_id: ctx.user_id,
        tenant_id: ctx.tenant_id,
        role_type: ctx.role_type,
        user,
      },
    };
  });
}
