-- 两步验证（TOTP）
alter table public.app_user add column if not exists two_factor_secret text;
alter table public.app_user add column if not exists two_factor_enabled boolean not null default false;
