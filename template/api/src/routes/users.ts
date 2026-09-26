import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.ts';
import { auth } from '../auth.ts';
import { db } from '../db.ts';
import { mailer } from '../lib/mailer.ts';

export function registerUsers(app: FastifyInstance): void {
  // 列表（管理员）
  app.get(
    '/api/users',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('app_user', 'select')] },
    async (req, reply) => {
      if (app.rlsKit.ctx(req).role_type !== 'tenant_admin') {
        return reply.code(403).send({ code: 403, msg: '仅管理员可查看账号列表', data: null });
      }
      const rows = await app.rlsKit.withContext(req, async (c) => {
        const r = await c.query(
          'select id, user_name, login_account, role_type, user_status, created_at from public.app_user order by created_at desc',
        );
        return r.rows;
      });
      return { code: 200, msg: 'success', data: rows };
    },
  );

  // 新建（管理员）
  app.post(
    '/api/users',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('app_user', 'insert')] },
    async (req, reply) => {
      const ctx = app.rlsKit.ctx(req);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const account = String(b.login_account ?? '').trim();
      const name = String(b.user_name ?? '').trim();
      const password = String(b.password ?? '');
      const role = b.role_type === 'tenant_admin' ? 'tenant_admin' : 'member';
      if (!account || !name || password.length < 6) {
        return reply
          .code(400)
          .send({ code: 400, msg: '账号/姓名必填，密码至少 6 位', data: null });
      }
      const hash = await auth.hashPassword(password);
      try {
        const row = await app.rlsKit.withContext(req, async (c) => {
          const r = await c.query(
            `insert into public.app_user(tenant_id, user_name, login_account, password_hash, role_type, user_status)
             values ($1, $2, $3, $4, $5, 'active')
             returning id, user_name, login_account, role_type, user_status`,
            [ctx.tenant_id, name, account, hash, role],
          );
          await app.rlsKit.audit(c, req, { type: '新建账号', sourceType: 'app_user', sourceId: r.rows[0].id });
          return r.rows[0];
        });
        return { code: 200, msg: 'success', data: row };
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.code(409).send({ code: 409, msg: '登录账号已存在', data: null });
        }
        throw err;
      }
    },
  );

  // 编辑（管理员）：角色 / 状态 / 重置密码
  app.patch(
    '/api/users/:id',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('app_user', 'update')] },
    async (req, reply) => {
      const ctx = app.rlsKit.ctx(req);
      const id = (req.params as { id: string }).id;
      const b = (req.body ?? {}) as Record<string, unknown>;

      if (id === ctx.user_id && b.user_status === 'disabled') {
        return reply.code(400).send({ code: 400, msg: '不能禁用自己的账号', data: null });
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      const push = (col: string, val: unknown) => {
        vals.push(val);
        sets.push(`${col} = $${vals.length}`);
      };
      if (b.role_type !== undefined) push('role_type', b.role_type === 'tenant_admin' ? 'tenant_admin' : 'member');
      if (b.user_status !== undefined) push('user_status', b.user_status === 'disabled' ? 'disabled' : 'active');
      if (b.password !== undefined) {
        if (String(b.password).length < 6) {
          return reply.code(400).send({ code: 400, msg: '密码至少 6 位', data: null });
        }
        push('password_hash', await auth.hashPassword(String(b.password)));
      }
      if (!sets.length) return reply.code(400).send({ code: 400, msg: '无可更新字段', data: null });
      sets.push('version = version + 1');
      vals.push(id);

      const row = await app.rlsKit.withContext(req, async (c) => {
        const r = await c.query(
          `update public.app_user set ${sets.join(', ')} where id = $${vals.length}
           returning id, user_name, login_account, role_type, user_status`,
          vals,
        );
        if (r.rowCount) {
          await app.rlsKit.audit(c, req, { type: '编辑账号', sourceType: 'app_user', sourceId: id });
        }
        return r.rows[0] ?? null;
      });
      if (!row) return reply.code(404).send({ code: 404, msg: '资源不存在', data: null });
      return { code: 200, msg: 'success', data: row };
    },
  );

  // 邀请成员（管理员）：创建 pending 用户 + 邀请令牌 + 邮件
  app.post(
    '/api/users/invite',
    { preHandler: [app.rlsKit.authenticate, app.rlsKit.can('app_user', 'insert')] },
    async (req, reply) => {
      const ctx = app.rlsKit.ctx(req);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const account = String(b.login_account ?? '').trim();
      const name = String(b.user_name ?? account).trim();
      const role = b.role_type === 'tenant_admin' ? 'tenant_admin' : 'member';
      if (!account) return reply.code(400).send({ code: 400, msg: '请填写登录账号', data: null });

      const exist = await app.rlsKit.withContext(req, async (c) =>
        c.query('select id, user_status from public.app_user where login_account = $1', [account]),
      );
      let userId: string;
      if (exist.rowCount) {
        if (exist.rows[0].user_status === 'active') {
          return reply.code(409).send({ code: 409, msg: '账号已存在', data: null });
        }
        userId = exist.rows[0].id as string;
      } else {
        const pw = await auth.hashPassword(randomBytes(16).toString('hex'));
        const ins = await app.rlsKit.withContext(req, async (c) =>
          c.query(
            `insert into public.app_user(tenant_id, user_name, login_account, password_hash, role_type, user_status)
             values ($1, $2, $3, $4, $5, 'pending') returning id`,
            [ctx.tenant_id, name, account, pw, role],
          ),
        );
        userId = ins.rows[0].id as string;
      }

      const token = randomBytes(24).toString('hex');
      const hash = createHash('sha256').update(token).digest('hex');
      await db.adminPool.query(
        `insert into public.auth_token(tenant_id, user_id, purpose, token_hash, expires_at)
         values ($1, $2, 'invite', $3, now() + interval '7 days')`,
        [ctx.tenant_id, userId, hash],
      );
      const link = `${config.publicBaseUrl}/accept-invite?token=${token}`;
      try {
        await mailer.send(account, '邀请加入', `请在 7 天内接受邀请并设置密码：${link}`);
      } catch {
        /* 邮件失败不阻断邀请 */
      }
      await app.rlsKit.withContext(req, async (c) => {
        await app.rlsKit.audit(c, req, { type: '邀请成员', sourceType: 'app_user', sourceId: userId });
      });
      return {
        code: 200,
        msg: 'success',
        data: { invite_link: config.exposeDevTokens ? link : undefined },
      };
    },
  );
}
