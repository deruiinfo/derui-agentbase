import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.ts';
import { auth } from '../auth.ts';
import { db } from '../db.ts';
import { mailer } from '../lib/mailer.ts';
import { totp } from '../lib/totp.ts';

type LoginResult = 'success' | 'fail' | 'locked' | 'disabled';

async function logLogin(entry: {
  tenant_id?: string | null;
  user_id?: string | null;
  account: string;
  result: LoginResult;
  ip?: string;
  ua?: string;
}): Promise<void> {
  try {
    await db.adminPool.query(
      `insert into public.login_log(tenant_id, user_id, login_account, result, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6)`,
      [entry.tenant_id ?? null, entry.user_id ?? null, entry.account, entry.result, entry.ip ?? null, entry.ua ?? null],
    );
  } catch {
    /* 登录日志失败不影响登录 */
  }
}

export function registerAuth(app: FastifyInstance): void {
  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body ?? {}) as { login_account?: string; password?: string };
    const account = String(body.login_account ?? '').trim();
    const password = String(body.password ?? '');
    const ip = req.ip;
    const ua = String(req.headers['user-agent'] ?? '');
    if (!account || !password) {
      return reply.code(400).send({ code: 400, msg: '请输入账号和密码', data: null });
    }

    const found = await db.adminPool.query(
      'select * from public.app_user where login_account = $1',
      [account],
    );
    if (found.rowCount === 0) {
      await logLogin({ account, result: 'fail', ip, ua });
      return reply.code(401).send({ code: 401, msg: '账号或密码错误', data: null });
    }
    const u = found.rows[0];

    if (u.user_status !== 'active') {
      await logLogin({ tenant_id: u.tenant_id, user_id: u.id, account, result: 'disabled', ip, ua });
      return reply.code(403).send({ code: 403, msg: '账号已被禁用或未激活', data: null });
    }
    if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
      await logLogin({ tenant_id: u.tenant_id, user_id: u.id, account, result: 'locked', ip, ua });
      return reply.code(423).send({ code: 423, msg: '账号已锁定，请稍后再试', data: null });
    }

    const ok = await auth.checkPassword(password, u.password_hash);
    if (!ok) {
      const fail = Number(u.fail_count ?? 0) + 1;
      const lockedUntil =
        fail >= config.loginMaxFail
          ? new Date(Date.now() + config.loginLockMinutes * 60_000)
          : null;
      await db.adminPool.query(
        'update public.app_user set fail_count = $1, locked_until = $2 where id = $3',
        [fail, lockedUntil, u.id],
      );
      await logLogin({ tenant_id: u.tenant_id, user_id: u.id, account, result: 'fail', ip, ua });
      return reply.code(401).send({ code: 401, msg: '账号或密码错误', data: null });
    }

    await db.adminPool.query(
      'update public.app_user set fail_count = 0, locked_until = null where id = $1',
      [u.id],
    );
    await logLogin({ tenant_id: u.tenant_id, user_id: u.id, account, result: 'success', ip, ua });
    if (u.two_factor_enabled) {
      const mfaToken = auth.sign({
        tenant_id: u.tenant_id,
        user_id: u.id,
        role_type: u.role_type,
        mfa_pending: true,
      });
      return { code: 200, msg: 'success', data: { mfa_required: true, mfa_token: mfaToken } };
    }
    const token = auth.sign({ tenant_id: u.tenant_id, user_id: u.id, role_type: u.role_type });
    await db.adminPool.query(
      `insert into public.operation_log(tenant_id, operate_user_id, operate_type, source_type, ip_address)
       values ($1, $2, '登录', 'app_user', $3)`,
      [u.tenant_id, u.id, req.ip],
    );

    return {
      code: 200,
      msg: 'success',
      data: {
        token,
        user: {
          id: u.id,
          user_name: u.user_name,
          login_account: u.login_account,
          role_type: u.role_type,
        },
      },
    };
  });

  app.post(
    '/api/auth/change-password',
    { preHandler: [app.rlsKit.authenticate] },
    async (req, reply) => {
      const ctx = app.rlsKit.ctx(req);
      const body = (req.body ?? {}) as { old_password?: string; new_password?: string };
      const oldPw = String(body.old_password ?? '');
      const newPw = String(body.new_password ?? '');
      if (newPw.length < 6) {
        return reply.code(400).send({ code: 400, msg: '新密码至少 6 位', data: null });
      }

      const row = await db.adminPool.query('select password_hash from public.app_user where id = $1', [
        ctx.user_id,
      ]);
      if (row.rowCount === 0 || !(await auth.checkPassword(oldPw, row.rows[0].password_hash))) {
        return reply.code(400).send({ code: 400, msg: '原密码错误', data: null });
      }

      const hash = await auth.hashPassword(newPw);
      await app.rlsKit.withContext(req, async (client) => {
        await client.query('update public.app_user set password_hash = $1 where id = $2', [
          hash,
          ctx.user_id,
        ]);
        await app.rlsKit.audit(client, req, { type: '修改密码', sourceType: 'app_user', sourceId: ctx.user_id });
      });
      return { code: 200, msg: 'success', data: null };
    },
  );

  // 忘记密码：始终返回成功（防账号枚举）；对存在且启用的账号发送重置链接
  app.post('/api/auth/password/forgot', async (req) => {
    const acc = String((req.body as { login_account?: string })?.login_account ?? '').trim();
    const data: Record<string, unknown> = { sent: true };
    if (acc) {
      const r = await db.adminPool.query(
        'select id, tenant_id, user_status, email, login_account from public.app_user where login_account = $1',
        [acc],
      );
      if (r.rowCount && r.rows[0].user_status === 'active') {
        const u = r.rows[0];
        const token = randomBytes(24).toString('hex');
        const hash = createHash('sha256').update(token).digest('hex');
        await db.adminPool.query(
          `insert into public.auth_token(tenant_id, user_id, purpose, token_hash, expires_at)
           values ($1, $2, 'password_reset', $3, now() + interval '30 minutes')`,
          [u.tenant_id, u.id, hash],
        );
        const link = `${config.publicBaseUrl}/reset?token=${token}`;
        try {
          await mailer.send(u.email || u.login_account, '重置密码', `请在 30 分钟内点击重置：${link}`);
        } catch (err) {
          req.log.error({ err }, 'send reset mail failed');
        }
        if (config.exposeDevTokens) data.reset_link = link;
      }
    }
    return { code: 200, msg: 'success', data };
  });

  // 重置密码
  app.post('/api/auth/password/reset', async (req, reply) => {
    const body = (req.body ?? {}) as { token?: string; new_password?: string };
    const token = String(body.token ?? '');
    const newPw = String(body.new_password ?? '');
    if (!token || newPw.length < 6) {
      return reply.code(400).send({ code: 400, msg: '参数不合法', data: null });
    }
    const hash = createHash('sha256').update(token).digest('hex');
    const r = await db.adminPool.query(
      `select id, user_id from public.auth_token
       where token_hash = $1 and purpose = 'password_reset' and used_at is null and expires_at > now()`,
      [hash],
    );
    if (!r.rowCount) {
      return reply.code(400).send({ code: 400, msg: '链接无效或已过期', data: null });
    }
    const t = r.rows[0];
    const pwHash = await auth.hashPassword(newPw);
    await db.adminPool.query(
      'update public.app_user set password_hash = $1, fail_count = 0, locked_until = null where id = $2',
      [pwHash, t.user_id],
    );
    await db.adminPool.query('update public.auth_token set used_at = now() where id = $1', [t.id]);
    return { code: 200, msg: 'success', data: null };
  });

  // 接受邀请：设密码并激活
  app.post('/api/auth/accept-invite', async (req, reply) => {
    const body = (req.body ?? {}) as { token?: string; password?: string; user_name?: string };
    const token = String(body.token ?? '');
    const password = String(body.password ?? '');
    const userName = String(body.user_name ?? '').trim();
    if (!token || password.length < 6) {
      return reply.code(400).send({ code: 400, msg: '参数不合法', data: null });
    }
    const hash = createHash('sha256').update(token).digest('hex');
    const r = await db.adminPool.query(
      `select id, user_id from public.auth_token
       where token_hash = $1 and purpose = 'invite' and used_at is null and expires_at > now()`,
      [hash],
    );
    if (!r.rowCount) {
      return reply.code(400).send({ code: 400, msg: '邀请链接无效或已过期', data: null });
    }
    const t = r.rows[0];
    const pwHash = await auth.hashPassword(password);
    await db.adminPool.query(
      `update public.app_user set password_hash = $1, user_status = 'active',
         user_name = coalesce(nullif($2, ''), user_name), fail_count = 0, locked_until = null
       where id = $3`,
      [pwHash, userName, t.user_id],
    );
    await db.adminPool.query('update public.auth_token set used_at = now() where id = $1', [t.id]);
    return { code: 200, msg: 'success', data: null };
  });

  // ===== 两步验证（TOTP）=====
  app.post('/api/auth/login/2fa', async (req, reply) => {
    const body = (req.body ?? {}) as { mfa_token?: string; code?: string };
    const code = String(body.code ?? '').trim();
    let claims: Record<string, unknown>;
    try {
      claims = auth.verify(body.mfa_token ?? '') as unknown as Record<string, unknown>;
    } catch {
      return reply.code(401).send({ code: 401, msg: '登录已过期，请重新登录', data: null });
    }
    if (claims.mfa_pending !== true) {
      return reply.code(400).send({ code: 400, msg: '请求不合法', data: null });
    }
    const r = await db.adminPool.query(
      'select id, tenant_id, user_name, login_account, role_type, user_status, two_factor_secret, two_factor_enabled from public.app_user where id = $1',
      [claims.user_id],
    );
    const u = r.rows[0];
    if (!u || !u.two_factor_enabled || !u.two_factor_secret || !totp.check(code, u.two_factor_secret)) {
      return reply.code(401).send({ code: 401, msg: '验证码错误', data: null });
    }
    const token = auth.sign({ tenant_id: u.tenant_id, user_id: u.id, role_type: u.role_type });
    await db.adminPool.query(
      `insert into public.operation_log(tenant_id, operate_user_id, operate_type, source_type, ip_address)
       values ($1, $2, '登录(2FA)', 'app_user', $3)`,
      [u.tenant_id, u.id, req.ip],
    );
    return {
      code: 200,
      msg: 'success',
      data: {
        token,
        user: { id: u.id, user_name: u.user_name, login_account: u.login_account, role_type: u.role_type },
      },
    };
  });

  app.post('/api/auth/2fa/setup', { preHandler: [app.rlsKit.authenticate] }, async (req) => {
    const ctx = app.rlsKit.ctx(req);
    const r = await db.adminPool.query('select login_account, two_factor_secret from public.app_user where id = $1', [ctx.user_id]);
    let secret = r.rows[0]?.two_factor_secret as string | undefined;
    if (!secret) {
      secret = totp.generateSecret();
      await db.adminPool.query('update public.app_user set two_factor_secret = $1 where id = $2', [secret, ctx.user_id]);
    }
    const otpauth = totp.keyuri(r.rows[0]?.login_account ?? ctx.user_id, secret, config.mfaIssuer);
    return { code: 200, msg: 'success', data: { secret, otpauth_url: otpauth } };
  });

  app.post('/api/auth/2fa/enable', { preHandler: [app.rlsKit.authenticate] }, async (req, reply) => {
    const ctx = app.rlsKit.ctx(req);
    const code = String((req.body as { code?: string })?.code ?? '').trim();
    const r = await db.adminPool.query('select two_factor_secret from public.app_user where id = $1', [ctx.user_id]);
    const secret = r.rows[0]?.two_factor_secret as string | undefined;
    if (!secret || !totp.check(code, secret)) {
      return reply.code(400).send({ code: 400, msg: '验证码错误', data: null });
    }
    await db.adminPool.query('update public.app_user set two_factor_enabled = true where id = $1', [ctx.user_id]);
    return { code: 200, msg: 'success', data: null };
  });

  app.post('/api/auth/2fa/disable', { preHandler: [app.rlsKit.authenticate] }, async (req, reply) => {
    const ctx = app.rlsKit.ctx(req);
    const code = String((req.body as { code?: string })?.code ?? '').trim();
    const r = await db.adminPool.query('select two_factor_secret from public.app_user where id = $1', [ctx.user_id]);
    const secret = r.rows[0]?.two_factor_secret as string | undefined;
    if (!secret || !totp.check(code, secret)) {
      return reply.code(400).send({ code: 400, msg: '验证码错误', data: null });
    }
    await db.adminPool.query('update public.app_user set two_factor_enabled = false where id = $1', [ctx.user_id]);
    return { code: 200, msg: 'success', data: null };
  });
}
