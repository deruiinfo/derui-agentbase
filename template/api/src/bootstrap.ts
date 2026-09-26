import type pg from 'pg';
import { config } from './config.ts';
import { auth } from './auth.ts';

/**
 * 幂等初始化：确保存在默认租户与管理员账号。
 * 单租户交付下，系统只会有一个默认租户。
 */
export async function ensureDefaultTenantAndAdmin(adminPool: pg.Pool): Promise<void> {
  const existing = await adminPool.query<{ id: string }>(
    'select id from public.tenant order by created_at asc limit 1',
  );
  let tenantId: string;
  if (existing.rowCount === 0) {
    const ins = await adminPool.query<{ id: string }>(
      'insert into public.tenant(tenant_name) values ($1) returning id',
      [config.defaultTenantName],
    );
    tenantId = ins.rows[0].id;
    process.stdout.write(`created default tenant ${tenantId}\n`);
  } else {
    tenantId = existing.rows[0].id;
  }

  const admin = await adminPool.query(
    'select id from public.app_user where login_account = $1',
    [config.adminAccount],
  );
  if (admin.rowCount === 0) {
    const hash = await auth.hashPassword(config.adminPassword);
    await adminPool.query(
      `insert into public.app_user(tenant_id, user_name, login_account, password_hash, role_type, user_status, email)
       values ($1, $2, $3, $4, 'tenant_admin', 'active', $5)`,
      [tenantId, config.adminAccount, config.adminAccount, hash, config.adminEmail || null],
    );
    process.stdout.write(`created admin account "${config.adminAccount}"\n`);
  }
}
