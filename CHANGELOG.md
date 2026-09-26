# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-26

Initial public release of **Derui AgentBase** — an on-premises-ready,
single-tenant admin scaffold built on PostgreSQL native Row-Level Security.

### Added

- **Core base**: authentication (JWT + bcrypt), RBAC, field-level permissions,
  PostgreSQL RLS row-level isolation, and an append-only audit log.
- **Two role domains**: `/admin` operations console and `/app` customer workspace.
- **`@rls-kit` engine** (`core` / `fastify` / `test`) vendored as tgz in
  `template/vendor/` for offline, registry-free builds.
- **`create-derui-admin` CLI**: copies `template/`, applies brand replacement
  (title/card/layout/package name/compose name) and generates a random `.env`.
- **Agent Kit** (AI-native base):
  - `AGENTS.md` machine-readable contract and recipe for adding resources.
  - `generate resource`: from `resources/<name>.json` produces table migration,
    schema rules, route, server registration, single-table RLS, CRUD page and menu.
  - `generate:rls --table <name>`: single-table RLS policy generation.
  - **MCP server** (zero-dependency, stdio / JSON-RPC 2.0) exposing
    `resource_list`, `resource_generate`, `typecheck`, `db_migrate`,
    `policy_preview`, `deploy_up` (requires `confirm=true`).
  - `test_run`: self-check that runs the permission matrix against generated resources.
- **Enterprise table-stakes**: password change, password reset (Mailer:
  console by default, SMTP via nodemailer), TOTP MFA, OIDC SSO (configurable
  provider, AES-256-GCM encrypted client secret), audit view + CSV export,
  and frontend pagination / search / required-field validation.
- **Account lifecycle (M4)**: login logging (success/fail/locked/disabled with
  IP/UA) and email member invitations with one-time tokens.
- **Deployment**: Docker Compose stack, migrations + generated RLS, nginx,
  backup / smoke-test / E2E scripts (`template/deploy/`).
- **License & governance**: Apache-2.0 (`LICENSE`, `NOTICE`), `CONTRIBUTING.md`,
  `SECURITY.md`, `CODE_OF_CONDUCT.md`, and an English `README.en.md`.

### Security

- Application DB role is `NOBYPASSRLS` (non-owner) so RLS is always enforced.
- Field-level permissions are enforced in the application layer, independent of RLS.
- `deploy_up` MCP tool requires explicit confirmation.
- Public repository excludes internal docs and secrets (guarded by `.gitignore`).

[Unreleased]: https://github.com/deruiinfo/derui-agentbase/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/deruiinfo/derui-agentbase/releases/tag/v0.1.0
