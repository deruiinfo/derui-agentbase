# Derui AgentBase

> Product: **Derui AgentBase** · npm: `@derui/agentbase` · License: **Apache-2.0** (see `LICENSE` / `NOTICE`)
>
> A **single-tenant, on-premises admin backend base** built on **PostgreSQL native RLS**,
> with an **AI-native Agent Kit**: write one resource declaration and let AI generate
> "table + permissions + API + pages".

## What it is
An out-of-the-box, self-hosted back-office skeleton for teams that can't use the cloud:
**login / RBAC / field-level permissions / row-level security (RLS) / audit**, plus AI-assisted
resource generation.

## Features
**Standard**
Login · change password · password reset (email) · MFA (TOTP) · **OIDC SSO** · RBAC ·
field-level permissions · row-level security (RLS) · audit log + CSV export · login log ·
member invites · list pagination/search/validation

**Differentiators**
- **AI-native (Agent Kit)**: `AGENTS.md` contract + schema-first generator + **MCP server** + self-check
- **PostgreSQL native RLS** (RBAC + field-level + row-level) with immutable audit
- **Private / offline**: engine is vendored, builds without an external registry

## Stack
Node ≥20 · Fastify · TypeScript · PostgreSQL 16 (RLS) · React 18 + Vite + Ant Design 5 · Docker Compose

## Quick start
```bash
# Option 1: generate a new project via CLI
node cli/bin/create-derui-admin.mjs my-admin --name "My Admin" --port 8080
cd my-admin && cp .env.example .env && docker compose up -d --build

# Option 2: use the template directly
cd template && cp .env.example .env && docker compose up -d --build
```
On first start it runs migrations and creates a **default tenant + admin**
(see `ADMIN_ACCOUNT` / `ADMIN_PASSWORD` in `.env` — **change it immediately**).

## AI-native (Agent Kit)
```bash
# Write one declaration resources/orders.json, then:
node tools/generate-resource.mjs orders   # table migration + RLS + API + CRUD page + menu
```
AI agents can also call the **MCP tools** (`resource_generate`, `test_run`, …) directly
(see `AGENTS.md`, `tools/mcp-server.mjs`).

## Layout
```
api/      Fastify backend
web/      React + AntD frontend (/admin + /app)
db/       Migrations (schema + generated RLS)
deploy/   Deploy / backup / smoke / E2E
tools/    Generator / MCP server / demo seed
cli/      create-derui-admin scaffold CLI
docs/     Architecture / Agent Kit / Roadmap / Demos
```

## Docs
- Architecture: `docs/architecture.md`
- Agent Kit: `docs/agent-kit.md`
- Roadmap: `docs/roadmap.md`
- Local demo: `docs/demos.md`

## License
**Apache-2.0**. See `LICENSE` and `NOTICE`.
