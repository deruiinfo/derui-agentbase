# Releasing & Release Engineering

Operational runbook for cutting releases and keeping the public repository in
shape. Audience: maintainers.

## 1. Versioning & changelog

- Follow [SemVer](https://semver.org/).
- Record every release in [`CHANGELOG.md`](../CHANGELOG.md) (Keep a Changelog).
- The published version lives in `cli/package.json`, `template/api/package.json`
  and `template/web/package.json` (keep them in sync).

## 2. Pre-release checklist (local)

```bash
# Backend
cd template/api && npm install && npx tsc --noEmit

# Frontend
cd template/web && npm install && npx tsc --noEmit && npm run build
```

- [ ] `CHANGELOG.md` updated, `[Unreleased]` moved to the new version
- [ ] Version bumped in the three `package.json` files
- [ ] No secrets committed (see §4)
- [ ] Public tree contains **no internal docs** (`sessionMemory/`, `0[0-7]-*.md`,
      `*-PRD*.md`) — guarded by `.gitignore`
- [ ] Community files present: `CONTRIBUTING.md`, `SECURITY.md`,
      `CODE_OF_CONDUCT.md`, `README.en.md`, `.github/`

## 3. Tag & release

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push <remote> vX.Y.Z
```

Then create a **GitHub Release** from the tag, pasting the changelog section.
Attach build assets (see §6).

## 4. Dependency & secret scanning

- **Dependabot**: enabled via `.github/dependabot.yml` (npm + GitHub Actions).
- **Dependency audit** (run per module, after `npm install`):
  ```bash
  cd template/api && npm audit --production
  cd ../web && npm audit
  ```
- **Secret scanning**: enable GitHub *Secret scanning* + *Push protection*
  (Settings → Code security). For a local pre-commit scan:
  ```bash
  gitleaks detect --no-git --source .
  ```
- **Never** commit `.env`, tokens, or credentials. `.gitignore` blocks `.env`.

## 5. SBOM

Generate a Software Bill of Materials and attach it to the release:

```bash
syft dir:. -o spdx-json=derui-agentbase.spdx.json
```

## 6. Offline image bundle (on-prem / air-gapped)

Build the stack and export images as a single tarball for offline operators:

```bash
cd template
docker compose build
docker save admin-scaffold-db admin-scaffold-api admin-scaffold-web \
  | gzip > derui-agentbase-images-vX.Y.Z.tar.gz
```

Attach `derui-agentbase-images-vX.Y.Z.tar.gz` to the GitHub Release.

## 7. Repository facade (GitHub)

- **About**: "On-premises-ready, AI-native admin scaffold with PostgreSQL RLS."
- **Topics**: `admin`, `rbac`, `rls`, `postgresql`, `fastify`, `react`,
  `self-hosted`, `on-premise`, `mcp`, `ai`, `agent`, `scaffold`
- **Social preview**: upload a 1280×640 image.
- Link the docs, live demo, and the enterprise contact page.

## 8. Package publishing (optional, adoption funnel)

- `@rls-kit/*` → private registry (or npm, scope `@derui`).
- `create-derui-admin` → npm. Remove `"private": true` from `cli/package.json`
  and run `npm publish` from `cli/`.
- `@derui/agentbase` is the reserved npm name for a future publish.

## 9. Gitee mirror

Keep the Gitee mirror (`njderui/derui-agentbase`) in sync on each release
(manual push or mirror-sync), and request Gitee "推荐/精选" listing.

## 10. Snapshot boundary (important)

This repository is the **public net snapshot** of an internal working copy:

| Public (`derui-agentbase`) | Internal (private) |
|---|---|
| Product code + user/contributor docs | session memory, governance, internal strategy |
| `CONTRIBUTING`/`SECURITY`/`CODE_OF_CONDUCT`, `.github/`, `CHANGELOG` | GASRACIS, credentials |

- Community/release files (`.github/`, `CHANGELOG.md`, governance) live **only**
  in the public repo; **preserve them** when regenerating the snapshot.
- Never copy `sessionMemory/`, `0[0-7]-*.md`, or `*-PRD*.md` into the public repo.
