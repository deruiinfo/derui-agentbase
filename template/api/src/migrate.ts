import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { config } from './config.ts';

/**
 * 迁移器：
 * 1) 确保应用角色存在（NOBYPASSRLS）并同步密码/授权
 * 2) 按序执行 db/migrations/*.sql（记录于 schema_migration）
 */
async function main(): Promise<void> {
  const admin = new pg.Pool({ connectionString: config.adminDatabaseUrl, max: 1 });
  try {
    await ensureAppRole(admin);

    await admin.query(`create table if not exists public.schema_migration (
      name text primary key,
      applied_at timestamptz not null default now()
    )`);

    const dir = resolve(process.cwd(), config.migrationsDir);
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set(
      (await admin.query<{ name: string }>('select name from public.schema_migration')).rows.map((r) => r.name),
    );

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(resolve(dir, file), 'utf8');
      process.stdout.write(`applying ${file} ...\n`);
      await admin.query('BEGIN');
      try {
        await admin.query(sql);
        await admin.query('insert into public.schema_migration(name) values ($1)', [file]);
        await admin.query('COMMIT');
      } catch (err) {
        await admin.query('ROLLBACK');
        throw err;
      }
    }
    await grantAppPrivileges(admin);
    process.stdout.write('migrations done\n');
  } finally {
    await admin.end();
  }
}

async function ensureAppRole(admin: pg.Pool): Promise<void> {
  const role = config.appDbRole;
  const pw = config.appDbPassword.replace(/'/g, "''");
  const exists = await admin.query('select 1 from pg_roles where rolname = $1', [role]);
  if (exists.rowCount === 0) {
    await admin.query(`create role ${role} login password '${pw}' nobypassrls`);
  } else {
    await admin.query(`alter role ${role} with login password '${pw}' nobypassrls`);
  }
}

async function grantAppPrivileges(admin: pg.Pool): Promise<void> {
  const role = config.appDbRole;
  await admin.query(`grant usage on schema public to ${role}`);
  await admin.query(`grant select, insert, update, delete on all tables in schema public to ${role}`);
  await admin.query(
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`,
  );
}

main().catch((err) => {
  process.stderr.write(`migrate failed: ${String(err)}\n`);
  process.exit(1);
});
