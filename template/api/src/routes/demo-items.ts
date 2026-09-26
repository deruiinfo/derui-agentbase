import type { FastifyInstance } from 'fastify';

/**
 * 演示资源：用于展示「RBAC + 字段级 + RLS 行级 + 审计」四件套。
 * member 只能看到本租户数据、且只能修改自己名下的记录（RLS where owner_id = current_user）。
 * 使用方可整体删除本模块。
 */
export function registerDemoItems(app: FastifyInstance): void {
  app.get(
    '/api/demo-items',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('demo_item', 'select')] },
    async (req) => {
      const rows = await app.rlsKit.withContext(req, async (c) => {
        const r = await c.query(
          'select id, title, status, owner_id, version, created_at from public.demo_item order by created_at desc',
        );
        return r.rows;
      });
      return { code: 200, msg: 'success', data: rows };
    },
  );

  app.post(
    '/api/demo-items',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('demo_item', 'insert')] },
    async (req, reply) => {
      const ctx = app.rlsKit.ctx(req);
      const data = app.rlsKit.pick(
        (req.body ?? {}) as Record<string, unknown>,
        'demo_item',
        'insert',
        ctx.role_type,
        { reject: true },
      );
      const title = String(data.title ?? '').trim();
      if (!title) return reply.code(400).send({ code: 400, msg: '标题必填', data: null });

      const row = await app.rlsKit.withContext(req, async (c) => {
        const r = await c.query(
          `insert into public.demo_item(tenant_id, title, status, owner_id)
           values ($1, $2, 'draft', $3)
           returning id, title, status, owner_id, version`,
          [ctx.tenant_id, title, ctx.user_id],
        );
        await app.rlsKit.audit(c, req, { type: '新建演示项', sourceType: 'demo_item', sourceId: r.rows[0].id });
        return r.rows[0];
      });
      return { code: 200, msg: 'success', data: row };
    },
  );

  app.patch(
    '/api/demo-items/:id',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('demo_item', 'update')] },
    async (req, reply) => {
      const ctx = app.rlsKit.ctx(req);
      const id = (req.params as { id: string }).id;
      const data = app.rlsKit.pick(
        (req.body ?? {}) as Record<string, unknown>,
        'demo_item',
        'update',
        ctx.role_type,
      );
      const sets: string[] = [];
      const vals: unknown[] = [];
      const push = (col: string, val: unknown) => {
        vals.push(val);
        sets.push(`${col} = $${vals.length}`);
      };
      if (data.title !== undefined) push('title', String(data.title));
      if (data.status !== undefined) push('status', data.status === 'published' ? 'published' : 'draft');
      if (!sets.length) return reply.code(400).send({ code: 400, msg: '无可更新字段', data: null });
      sets.push('version = version + 1');
      vals.push(id);

      const row = await app.rlsKit.withContext(req, async (c) => {
        const r = await c.query(
          `update public.demo_item set ${sets.join(', ')} where id = $${vals.length}
           returning id, title, status, owner_id, version`,
          vals,
        );
        if (r.rowCount) {
          await app.rlsKit.audit(c, req, { type: '编辑演示项', sourceType: 'demo_item', sourceId: id });
        }
        return r.rows[0] ?? null;
      });
      if (!row) {
        // RLS 下：不存在 或 非本人记录（member 越权）均返回 404
        return reply.code(404).send({ code: 404, msg: '资源不存在或无权修改', data: null });
      }
      return { code: 200, msg: 'success', data: row };
    },
  );
}
