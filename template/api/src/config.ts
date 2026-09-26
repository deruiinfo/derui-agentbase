import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.APP_JWT_SECRET || 'dev-secret-change-me',
  jwtExpireHours: Number(process.env.APP_JWT_EXPIRE_HOURS || 2),

  adminDatabaseUrl:
    process.env.DATABASE_URL_ADMIN || 'postgres://postgres:postgres@db:5432/app',
  appDatabaseUrl:
    process.env.DATABASE_URL_APP || 'postgres://app_user:app_user_pw@db:5432/app',
  appDbPassword: process.env.APP_DB_PASSWORD || 'app_user_pw',
  appDbRole: process.env.APP_DB_ROLE || 'app_user',

  migrationsDir: process.env.MIGRATIONS_DIR || './db/migrations',

  adminAccount: process.env.ADMIN_ACCOUNT || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'change-me',
  adminEmail: process.env.ADMIN_EMAIL || '',
  defaultTenantName: process.env.DEFAULT_TENANT_NAME || 'Default Organization',

  // 找回密码 / 邮件
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  exposeDevTokens: String(process.env.AUTH_EXPOSE_DEV_TOKENS || 'false') === 'true',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false') === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'no-reply@derui.local',
  mfaIssuer: process.env.MFA_ISSUER || 'derui-admin',
  oidcSecretKey: process.env.OIDC_SECRET_KEY || '',

  loginMaxFail: Number(process.env.LOGIN_MAX_FAIL || 5),
  loginLockMinutes: Number(process.env.LOGIN_LOCK_MINUTES || 30),
};
