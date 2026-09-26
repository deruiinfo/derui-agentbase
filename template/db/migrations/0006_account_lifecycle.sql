-- 登录日志 + 账号状态(pending) + 邀请令牌用途
create table if not exists public.login_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,
  user_id       uuid,
  login_account text,
  result        text not null check (result in ('success','fail','locked','disabled')),
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_login_log_created on public.login_log(created_at desc);
alter table public.login_log enable row level security;

-- app_user 状态支持 pending（邀请未接受）
alter table public.app_user drop constraint if exists app_user_user_status_check;
alter table public.app_user add constraint app_user_user_status_check
  check (user_status in ('active','disabled','pending'));

-- auth_token 用途扩展：邀请
alter table public.auth_token drop constraint if exists auth_token_purpose_check;
alter table public.auth_token add constraint auth_token_purpose_check
  check (purpose in ('password_reset','invite'));
