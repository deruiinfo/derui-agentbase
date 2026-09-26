-- 邮箱字段 + 找回密码令牌
alter table public.app_user add column if not exists email text;

create table if not exists public.auth_token (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id) on delete restrict,
  user_id    uuid not null references public.app_user(id) on delete restrict,
  purpose    text not null check (purpose in ('password_reset')),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_token_hash on public.auth_token(token_hash);

-- 令牌表仅后台(超管)使用；RLS 开启且不建策略 → 应用角色不可访问
alter table public.auth_token enable row level security;
