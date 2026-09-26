import Fastify from 'fastify';
import cors from '@fastify/cors';
import { rlsKitPlugin, RlsKitError } from '@rls-kit/fastify';
import { config } from './config.ts';
import { schema } from './schema.ts';
import { db } from './db.ts';
import { auth } from './auth.ts';
import { ensureDefaultTenantAndAdmin } from './bootstrap.ts';
import { registerHealth } from './routes/health.ts';
import { registerAuth } from './routes/auth.ts';
import { registerMe } from './routes/me.ts';
import { registerUsers } from './routes/users.ts';
import { registerLogs } from './routes/logs.ts';
import { registerLoginLogs } from './routes/login-logs.ts';
import { registerExport } from './routes/export.ts';
import { registerOidc } from './routes/oidc.ts';
import { registerDemoItems } from './routes/demo-items.ts';
// <generated:imports>

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

await app.register(rlsKitPlugin, {
  schema,
  db,
  auth,
  audit: { table: 'operation_log' },
  unauthorizedMessage: '登录已过期，请重新登录',
  forbiddenMessage: '您当前角色无此操作权限',
});

registerHealth(app);
registerAuth(app);
registerMe(app);
registerUsers(app);
registerLogs(app);
registerLoginLogs(app);
registerExport(app);
registerOidc(app);
registerDemoItems(app);
// <generated:registers>

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof RlsKitError) {
    return reply.code(err.statusCode).send({ code: err.statusCode, msg: err.message, data: null });
  }
  const raw = (err as { statusCode?: number }).statusCode ?? 500;
  const pgCode = (err as { code?: string }).code;
  const status = raw >= 500 && pgCode === '22P02' ? 400 : raw;
  if (status >= 500) app.log.error(err);
  else app.log.warn({ status, msg: err.message }, 'client error');
  const msg =
    status >= 500
      ? '系统繁忙，请稍后重试'
      : status === 400
        ? '请求参数格式有误'
        : err.message || '请求有误';
  return reply.code(status).send({ code: status, msg, data: null });
});

// 幂等初始化：默认租户 + 管理员
await ensureDefaultTenantAndAdmin(db.adminPool);

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then((addr) => app.log.info(`admin-scaffold api listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
