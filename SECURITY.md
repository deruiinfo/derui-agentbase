# Security Policy

## Supported versions
The latest released version (see tags) receives security fixes.

## Reporting a vulnerability
Please **do not** open a public issue for security problems.

Report privately via one of:
- GitHub **Security Advisories** (repository → Security → Report a vulnerability), preferred.
- Email: `<security@your-domain>` (replace with your contact).

Include: affected version/commit, a description, reproduction steps, and impact.
We aim to acknowledge within a few business days and will coordinate a fix and disclosure.

## Deployment hardening (operators)
- Change `ADMIN_PASSWORD` immediately after first launch.
- Use strong `APP_JWT_SECRET` / `OIDC_SECRET_KEY`; keep secrets in `.env` (never in git).
- The application DB role must be **`NOBYPASSRLS`** (non-owner) so Row-Level Security applies.
- Terminate TLS at the reverse proxy; restrict `/api` to your network.
- Enable MFA and, where possible, OIDC SSO for administrators.
- Keep backups (`deploy/backup.sh`) and review `operation_log` / `login_log`.
