# {{brand}} · 单租户自托管后台

由 Derui AgentBase 脚手架生成。基于 **Fastify + PostgreSQL RLS + React/AntD**。

## 快速开始

```bash
cp .env.example .env        # 修改数据库密码 / JWT 密钥
docker compose up -d --build
```

- 管理后台：`http://127.0.0.1:8080`（端口见 `.env` 的 `WEB_PORT`）
- 初始账号：`.env` 的 `ADMIN_ACCOUNT` / `ADMIN_PASSWORD`（首次启动自动创建）

## 结构

```
api/   Fastify：登录 / 账号 / RBAC / 字段级 / 审计 / 演示资源
web/   React 18 + AntD 5：/admin（运营管理后台）+ /app（客户工作台）
db/    migrations（0001 schema + 0002 RLS 自动生成）
deploy/DEPLOY.md 备份 冒烟
```

## 权限模型

`api/src/schema.ts` 用 `@rls-kit` 声明式定义访问模型；RLS DDL 由它生成：

```bash
cd api && npm run generate:rls   # 重新生成 db/migrations/0002_rls.sql
```

- **行级（RLS）**：PostgreSQL 策略读 `current_setting('app.*')`
- **字段级**：`@rls-kit` `pick()` 在应用层裁剪
- **RBAC**：`app.rlsKit.can(table, action)`
- **审计**：写操作落 `operation_log`

## 引擎依赖（离线自包含）

`@rls-kit/*` 以 **tgz 形式内置于 `vendor/`**（`api/package.json` 用 `file:../vendor/...`），
**无需任何 registry 即可 `npm install` / `docker build`**，适配私有化/离线环境。

> 若将来 `@rls-kit` 发布到 registry，可把 `file:` 改为版本号（`^0.1.0`）。

## 本地开发（不用 Docker）

```bash
cd api && npm install && npm run migrate && npm run dev
cd web && npm install && npm run dev
```

## 端到端验收

```bash
export DATABASE_URL_ADMIN='postgres://postgres:pw@127.0.0.1:5432/scaffold_e2e'
export DATABASE_URL_APP='postgres://app_user:app_user_pw@127.0.0.1:5432/scaffold_e2e'
bash deploy/e2e.sh    # 迁移 + 启 API + 权限/RLS/审计 矩阵
```

## 生产注意

- 首次启动会跑 `migrate` 并创建默认租户 + 管理员。
- 应用连接必须使用 `app_user`（`NOBYPASSRLS`），否则 RLS 失效。
- 每日备份见 `deploy/backup.sh`。
