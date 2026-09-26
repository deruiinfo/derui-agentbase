-- =============================================================
-- Derui AgentBase — 0001 schema（单租户交付，多租户底座）
-- 通则：uuid 主键 / tenant_id 隔离 / version 乐观锁 / timestamptz /
--       外键 ON DELETE RESTRICT（禁 CASCADE）。
-- 仅保留基座表 + 一个演示实体 demo_item。
-- =============================================================

create extension if not exists pgcrypto;

-- 更新时间触发器
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 租户（单租户交付：默认仅 1 行；底座保留多租户能力）
create table public.tenant (
  id          uuid primary key default gen_random_uuid(),
  tenant_name text not null,
  config_json jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 用户
create table public.app_user (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete restrict,
  user_name     text not null,
  login_account text not null unique,
  password_hash text not null,
  role_type     text not null default 'member' check (role_type in ('tenant_admin','member')),
  user_status   text not null default 'active' check (user_status in ('active','disabled')),
  fail_count    int  not null default 0,
  locked_until  timestamptz,
  version       int  not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 审计日志（不可改删；仅管理员可查）
create table public.operation_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete restrict,
  operate_user_id uuid,
  operate_type    text not null,
  source_type     text,
  source_id       text,
  platform        text,
  diff_json       jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

-- 演示实体（工作台示例；使用方可整体删除）
create table public.demo_item (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id) on delete restrict,
  version    int  not null default 1,
  title      text not null,
  status     text not null default 'draft' check (status in ('draft','published')),
  owner_id   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 索引
create index idx_app_user_tenant on public.app_user(tenant_id, user_status);
create index idx_operation_log_tenant_created on public.operation_log(tenant_id, created_at desc);
create index idx_demo_item_tenant on public.demo_item(tenant_id, status);

-- updated_at 触发器
create trigger trg_tenant_updated   before update on public.tenant      for each row execute function public.set_updated_at();
create trigger trg_app_user_updated before update on public.app_user    for each row execute function public.set_updated_at();
create trigger trg_demo_item_updated before update on public.demo_item  for each row execute function public.set_updated_at();
