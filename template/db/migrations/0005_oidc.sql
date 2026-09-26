-- OIDC SSO 配置（单租户一行）+ 登录态
create table if not exists public.oidc_config (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenant(id) on delete restrict,
  enabled                boolean not null default false,
  issuer_url             text,
  authorization_endpoint text,
  token_endpoint         text,
  jwks_uri               text,
  userinfo_endpoint      text,
  client_id              text,
  client_secret_enc      text,
  scopes                 text not null default 'openid email profile',
  claim_username         text not null default 'preferred_username',
  claim_email            text not null default 'email',
  claim_groups           text not null default 'groups',
  group_role_map         jsonb not null default '{}',
  default_role           text not null default 'member',
  updated_at             timestamptz not null default now(),
  unique (tenant_id)
);
alter table public.oidc_config enable row level security;

create table if not exists public.oidc_state (
  state          text primary key,
  tenant_id      uuid not null,
  nonce          text not null,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);
alter table public.oidc_state enable row level security;
