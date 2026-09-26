# Contributing to Derui AgentBase

Thanks for your interest! This project is an open-source, self-hostable admin backend base
(Fastify + PostgreSQL RLS + React/AntD) with an AI-native "Agent Kit".

By contributing you agree that your contributions are licensed under the
[Apache License 2.0](./LICENSE).

## Ground rules
- Be respectful — see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- **Never commit secrets** (`.env`, keys, tokens, credentials) or internal documents
  (session logs, project governance). `.gitignore` already blocks these.
- Keep changes focused; one PR = one topic.
- Add/update tests or the E2E script when behavior changes.

## Development

```bash
# Backend
cd template/api && npm install && npx tsc --noEmit

# Frontend
cd template/web && npm install && npx tsc --noEmit && npm run build

# Run locally
cd template && cp .env.example .env && docker compose up -d --build
```

## Project layout
```
api/      Fastify backend (auth / RBAC / field-level / RLS / audit / routes)
web/      React + Ant Design frontend (/admin console + /app workspace)
db/       Migrations (schema + generated RLS policies)
deploy/   Deploy / backup / smoke / E2E scripts
tools/    Resource generator / MCP server / demo seed
cli/      create-derui-admin scaffold CLI
docs/     Architecture / Agent Kit / Roadmap / Demos
```

## Adding a business resource
1. Write `resources/<name>.json` (fields + roles).
2. Run `node tools/generate-resource.mjs <name>` — generates table migration,
   schema rules, route, registration, RLS, CRUD page and menu.

## Pull requests
- Describe the motivation and the change.
- Ensure `tsc --noEmit` passes for `api` and `web`.
- Update docs when relevant.
- Keep the public repo free of internal/secret material.

## Reporting issues
Use GitHub Issues. For security issues, see [`SECURITY.md`](./SECURITY.md).
