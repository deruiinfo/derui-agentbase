# 部署指南 · Derui AgentBase

## 1. 前置

- Docker + Docker Compose
- 单租户下只需一台内网主机（私有化部署）
- `@rls-kit/*` 已可从 registry 安装（见根仓 `docs/roadmap.md` 引擎归属）

## 2. 首次部署

```bash
cp .env.example .env
# 编辑：数据库密码 / JWT 密钥 / 管理员初始密码
docker compose up -d --build
```

首次启动 `api` 会：
1. 执行 `db/migrations/*.sql`（含 RLS 策略）
2. 创建应用角色 `app_user`（`NOBYPASSRLS`）并授权
3. 幂等创建默认租户 + 管理员

访问 `http://<host>:${WEB_PORT}`。

## 3. 服务与端口

| 服务 | 端口 | 暴露 |
|------|------|------|
| web(nginx) | `${WEB_PORT}:80` | 团队可见 |
| api | 3001 | 127.0.0.1 |
| db | 5432 | 127.0.0.1 |

## 4. 备份

```bash
./deploy/backup.sh          # pg_dump -> ./backups/db-<ts>.sql.gz，保留 7 天
# 建议加入 cron：0 3 * * * cd /opt/admin && ./deploy/backup.sh
```

## 5. 冒烟

```bash
./deploy/smoke-test.sh
```

## 6. 升级

```bash
git pull
docker compose up -d --build
# 新增迁移由 api 启动时自动应用
```

## 7. 回滚

- 代码：`git checkout <旧 tag>` → `docker compose up -d --build`
- 数据：恢复最近备份
  ```bash
  gunzip -c backups/db-<ts>.sql.gz | docker compose exec -T db psql -U postgres -d app
  ```

## 8. 离线 / 私有化

- 引擎 `@rls-kit/*` 已内置 `vendor/*.tgz`，**无需外网 registry**。
- 若主机无外网：用环境自带的离线 Docker 包安装 Docker（参见内网离线安装手册），或改用 **非 Docker 部署**：
  ```bash
  # 主机已装 PostgreSQL；建库后直接跑
  cd api && npm install     # 依赖来自 vendor/，离线可装
  export DATABASE_URL_ADMIN=... DATABASE_URL_APP=...
  npm run migrate && npm run start
  cd ../web && npm install && npm run build   # 产物交给 nginx
  ```

## 9. 端到端验收

```bash
export DATABASE_URL_ADMIN='postgres://postgres:pw@127.0.0.1:5432/scaffold_e2e'
export DATABASE_URL_APP='postgres://app_user:app_user_pw@127.0.0.1:5432/scaffold_e2e'
createdb scaffold_e2e   # 若不存在
bash deploy/e2e.sh
```

覆盖：迁移 → 健康 → 登录(含错误密码) → RBAC(成员 403) → RLS 行级(成员改他人记录 404 / 改自己 200) → 字段级(注入 tenant_id 403) → 审计。

Docker 环境（已在本机运行 compose 时）：

```bash
BASE_URL=http://127.0.0.1:8090 bash deploy/e2e-docker.sh
```

覆盖：登录 / RBAC / RLS 行级(API + DB 层 app_user 无上下文=0) / 字段级 / 审计。

> 已在隔离环境下端到端实测：迁移 + 冒烟通过。
