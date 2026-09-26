import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { config } from '../config.ts';
import { auth } from '../auth.ts';
import { db } from '../db.ts';
import { buildAuthUrl, discover, encryptSecret, exchangeCode, mapClaims, verifyIdToken, type OidcConfigRow } from '../lib/oidc.ts';

function redirectUri(req: FastifyRequest): string {
  const base = config.publicBaseUrl || `${req.protocol}://${req.headers.host}`;
  return `${base}/api/auth/oidc/callback`;
}

async function loadConfig(): Promise<OidcConfigRow | null> {
  const r = await db.adminPool.query('select * from public.oidc_config order by updated_at desc limit 1');
  return (r.rows[0] as OidcConfigRow) ?? null;
}

export function registerOidc(app: FastifyInstance): void {
  // ── 公开：是否启用 ──
  app.get('/api/auth/oidc/enabled', async () => {
    const r = await db.adminPool.query('select enabled from public.oidc_config where enabled = true limit 1');
    return { code: 200, msg: 'success', data: { enabled: r.rowCount === 1 } };
  });

  // ── 公开：发起登录（跳转 IdP）──
  app.get('/api/auth/oidc/start', async (req, reply) => {
    const cfg = await loadConfig();
    if (!cfg || !cfg.enabled) {
      return reply.code(400).send({ code: 400, msg: 'SSO 未启用', data: null });
    }
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    await db.adminPool.query(
      `insert into public.oidc_state(state, tenant_id, nonce, expires_at) values ($1,$2,$3, now() + interval '10 minutes')`,
      [state, cfg.tenant_id, nonce],
    );
    reply.redirect(buildAuthUrl(cfg, state, nonce, redirectUri(req)));
  });

  // ── 公开：回调 ──
  app.get('/api/auth/oidc/callback', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const back = (p: string) => `${config.publicBaseUrl || ''}/login?${p}`;
    try {
      if (!q.code || !q.state) throw new Error('缺少 code/state');
      const st = await db.adminPool.query(
        'select * from public.oidc_state where state = $1 and expires_at > now()',
        [q.state],
      );
      if (!st.rowCount) throw new Error('state 无效或已过期');
      const nonce = st.rows[0].nonce as string;
      const cfg = await loadConfig();
      if (!cfg || !cfg.enabled) throw new Error('SSO 未启用');

      const tokenRes = await exchangeCode(cfg, q.code, redirectUri(req));
      if (!tokenRes.id_token) throw new Error('未返回 id_token');
      const claims = await verifyIdToken(cfg, tokenRes.id_token);
      if (claims.nonce !== nonce) throw new Error('nonce 校验失败');
      const mapped = mapClaims(cfg, claims);

      let u = (
        await db.adminPool.query('select * from public.app_user where login_account = $1', [mapped.username])
      ).rows[0];
      if (!u) {
        const pw = await auth.hashPassword(randomBytes(16).toString('hex'));
        u = (
          await db.adminPool.query(
            `insert into public.app_user(tenant_id, user_name, login_account, password_hash, role_type, user_status, email)
             values ($1, $2, $3, $4, $5, 'active', $6) returning *`,
            [cfg.tenant_id, mapped.username, mapped.username, pw, mapped.role, mapped.email],
          )
        ).rows[0];
      } else if (u.user_status !== 'active') {
        throw new Error('账号已被禁用');
      }
      await db.adminPool.query('delete from public.oidc_state where state = $1', [q.state]);
      const token = auth.sign({ tenant_id: u.tenant_id, user_id: u.id, role_type: u.role_type });
      return reply.redirect(back(`oidc_token=${token}`));
    } catch (err) {
      req.log.error({ err }, 'oidc callback failed');
      return reply.redirect(back(`oidc_error=${encodeURIComponent(String((err as Error).message))}`));
    }
  });

  // ── 管理：读取配置 ──
  app.get('/api/admin/oidc', { preHandler: [app.rlsKit.authenticate] }, async (req, reply) => {
    if (app.rlsKit.ctx(req).role_type !== 'tenant_admin') {
      return reply.code(403).send({ code: 403, msg: '仅管理员', data: null });
    }
    const cfg = await loadConfig();
    if (!cfg) return { code: 200, msg: 'success', data: { enabled: false } };
    const { client_secret_enc, ...rest } = cfg;
    return {
      code: 200,
      msg: 'success',
      data: { ...rest, client_secret_set: Boolean(client_secret_enc), redirect_uri: redirectUri(req) },
    };
  });

  // ── 管理：连接测试（Discovery）──
  app.post('/api/admin/oidc/test', { preHandler: [app.rlsKit.authenticate] }, async (req, reply) => {
    if (app.rlsKit.ctx(req).role_type !== 'tenant_admin') {
      return reply.code(403).send({ code: 403, msg: '仅管理员', data: null });
    }
    const issuer = String((req.body as { issuer_url?: string })?.issuer_url ?? '').trim();
    if (!issuer) return reply.code(400).send({ code: 400, msg: '请填写 Issuer URL', data: null });
    try {
      const ep = await discover(issuer);
      return { code: 200, msg: 'success', data: { ok: true, endpoints: ep } };
    } catch (err) {
      return { code: 200, msg: 'success', data: { ok: false, error: String((err as Error).message) } };
    }
  });

  // ── 管理：保存配置 ──
  app.put('/api/admin/oidc', { preHandler: [app.rlsKit.authenticate] }, async (req, reply) => {
    const ctx = app.rlsKit.ctx(req);
    if (ctx.role_type !== 'tenant_admin') {
      return reply.code(403).send({ code: 403, msg: '仅管理员', data: null });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const issuer = String(b.issuer_url ?? '').trim();
    let ep = {
      authorization_endpoint: String(b.authorization_endpoint ?? ''),
      token_endpoint: String(b.token_endpoint ?? ''),
      jwks_uri: String(b.jwks_uri ?? ''),
      userinfo_endpoint: String(b.userinfo_endpoint ?? '') || null,
    };
    if (issuer && (!ep.authorization_endpoint || !ep.token_endpoint || !ep.jwks_uri)) {
      try {
        const d = await discover(issuer);
        ep = {
          authorization_endpoint: d.authorization_endpoint,
          token_endpoint: d.token_endpoint,
          jwks_uri: d.jwks_uri,
          userinfo_endpoint: d.userinfo_endpoint ?? null,
        };
      } catch (err) {
        return reply.code(400).send({ code: 400, msg: `Discovery 失败：${(err as Error).message}`, data: null });
      }
    }
    const secret = b.client_secret ? encryptSecret(String(b.client_secret)) : null;
    const existing = await db.adminPool.query('select client_secret_enc from public.oidc_config where tenant_id=$1', [ctx.tenant_id]);
    const secretEnc = secret ?? existing.rows[0]?.client_secret_enc ?? null;

    await db.adminPool.query(
      `insert into public.oidc_config(tenant_id, enabled, issuer_url, authorization_endpoint, token_endpoint, jwks_uri, userinfo_endpoint, client_id, client_secret_enc, scopes, claim_username, claim_email, claim_groups, group_role_map, default_role, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
       on conflict (tenant_id) do update set
         enabled=excluded.enabled, issuer_url=excluded.issuer_url,
         authorization_endpoint=excluded.authorization_endpoint, token_endpoint=excluded.token_endpoint,
         jwks_uri=excluded.jwks_uri, userinfo_endpoint=excluded.userinfo_endpoint,
         client_id=excluded.client_id, client_secret_enc=excluded.client_secret_enc, scopes=excluded.scopes,
         claim_username=excluded.claim_username, claim_email=excluded.claim_email, claim_groups=excluded.claim_groups,
         group_role_map=excluded.group_role_map, default_role=excluded.default_role, updated_at=now()`,
      [
        ctx.tenant_id,
        b.enabled === true,
        issuer || null,
        ep.authorization_endpoint || null,
        ep.token_endpoint || null,
        ep.jwks_uri || null,
        ep.userinfo_endpoint,
        String(b.client_id ?? '') || null,
        secretEnc,
        String(b.scopes ?? 'openid email profile'),
        String(b.claim_username ?? 'preferred_username'),
        String(b.claim_email ?? 'email'),
        String(b.claim_groups ?? 'groups'),
        JSON.stringify(b.group_role_map ?? {}),
        String(b.default_role ?? 'member'),
      ],
    );
    return { code: 200, msg: 'success', data: null };
  });
}
