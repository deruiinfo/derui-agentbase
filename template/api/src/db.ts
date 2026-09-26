import { createDatabase } from '@rls-kit/core/db';
import { config } from './config.ts';
import { schema } from './schema.ts';

/** 业务连接走 appPool（RLS 生效）；登录/后台走 adminPool（BYPASSRLS）。 */
export const db = createDatabase({
  adminUrl: config.adminDatabaseUrl,
  appUrl: config.appDatabaseUrl,
  context: schema.context,
});
