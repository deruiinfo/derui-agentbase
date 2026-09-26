import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.ts';

export interface OidcEndpoints {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

function key(): Buffer {
  return createHash('sha256').update(config.oidcSecretKey || config.jwtSecret).digest();
}

/** 加密 client_secret（AES-256-GCM） */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** 基于 issuer 的 OIDC Discovery */
export async function discover(issuerUrl: string): Promise<OidcEndpoints> {
  const base = issuerUrl.replace(/\/$/, '');
  const url = `${base}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`discovery 失败：HTTP ${res.status}（${url}）`);
  const j = (await res.json()) as Record<string, string>;
  if (!j.authorization_endpoint || !j.token_endpoint || !j.jwks_uri) {
    throw new Error('discovery 文档缺少必要端点');
  }
  return {
    issuer: j.issuer || base,
    authorization_endpoint: j.authorization_endpoint,
    token_endpoint: j.token_endpoint,
    jwks_uri: j.jwks_uri,
    userinfo_endpoint: j.userinfo_endpoint,
  };
}

export interface OidcConfigRow {
  enabled: boolean;
  issuer_url: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  client_id: string;
  client_secret_enc: string;
  scopes: string;
  claim_username: string;
  claim_email: string;
  claim_groups: string;
  group_role_map: Record<string, string>;
  default_role: string;
  tenant_id: string;
}

export function buildAuthUrl(cfg: OidcConfigRow, state: string, nonce: string, redirectUri: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.client_id,
    redirect_uri: redirectUri,
    scope: cfg.scopes || 'openid email profile',
    state,
    nonce,
  });
  return `${cfg.authorization_endpoint}?${p.toString()}`;
}

export async function exchangeCode(
  cfg: OidcConfigRow,
  code: string,
  redirectUri: string,
): Promise<{ id_token?: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: cfg.client_id,
    client_secret: decryptSecret(cfg.client_secret_enc),
  });
  const res = await fetch(cfg.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token 交换失败：HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as { id_token?: string };
}

export async function verifyIdToken(cfg: OidcConfigRow, idToken: string): Promise<JWTPayload> {
  const jwks = createRemoteJWKSet(new URL(cfg.jwks_uri));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: cfg.issuer_url.replace(/\/$/, ''),
    audience: cfg.client_id,
  });
  return payload;
}

export function mapClaims(
  cfg: Pick<OidcConfigRow, 'claim_username' | 'claim_email' | 'claim_groups' | 'group_role_map' | 'default_role'>,
  claims: JWTPayload,
): { username: string; email: string | null; role: string } {
  const pick = (name: string): unknown => (claims as Record<string, unknown>)[name];
  const username = pick(cfg.claim_username) ?? claims.preferred_username ?? claims.email ?? claims.sub;
  const email = pick(cfg.claim_email) ?? claims.email ?? null;
  let role = cfg.default_role || 'member';
  const groups = cfg.claim_groups ? pick(cfg.claim_groups) : undefined;
  if (groups && cfg.group_role_map) {
    const arr = Array.isArray(groups) ? groups : [groups];
    for (const g of arr) {
      const mapped = cfg.group_role_map[String(g)];
      if (mapped) {
        role = mapped;
        break;
      }
    }
  }
  return { username: String(username), email: email ? String(email) : null, role };
}
