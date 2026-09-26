# Derui AgentBase

> 产品名：**Derui AgentBase**　·　npm：`@derui/agentbase`　·　许可：**Apache-2.0**（见 `LICENSE` / `NOTICE`）
>
> **面向私有化部署（on-prem / 内网）的单租户后台脚手架**，基于 **PostgreSQL 原生 RLS 三层权限**；
> 内置 **AI 原生 Agent Kit**：写一行资源声明，AI 生成「表 + 权限 + API + 页面」。

## 一句话定位
给「上不了云」的团队一个开箱即用的自托管中后台骨架：**登录 / RBAC / 字段级权限 / 行级隔离(RLS) / 审计**，并可让 AI 快速生成业务资源。

## 能力
**标准配置（企业必需）**
登录鉴权 · 改密 · 找回密码（邮件） · MFA(TOTP) · **OIDC SSO** · RBAC · 字段级权限 · 行级隔离(RLS) · 审计日志+导出 · 登录日志 · 邀请成员 · 列表分页/搜索/校验

**特色（差异化）**
- **AI 原生（Agent Kit）**：`AGENTS.md` 契约 + schema-first 生成器 + **MCP Server** + 自检闭环
- **PostgreSQL 原生 RLS 三层权限 + 不可变审计**
- **私有化 / 离线自包含**：引擎内置，无外网 registry 也能构建

## 技术栈
Node ≥20 · Fastify · TypeScript · PostgreSQL 16（RLS）· React 18 + Vite + Ant Design 5 · Docker Compose

## 快速开始
```bash
# 方式一：CLI 生成一个新项目
node cli/bin/create-derui-admin.mjs my-admin --name "My Admin" --port 8080
cd my-admin && cp .env.example .env && docker compose up -d --build

# 方式二：直接用模板
cd template && cp .env.example .env && docker compose up -d --build
```
首次启动会自动执行迁移并创建**默认租户 + 管理员**（账号见 `.env` 的 `ADMIN_ACCOUNT` / `ADMIN_PASSWORD`，**请立即修改**）。

## AI 原生（Agent Kit）
```bash
# 写一行资源声明 resources/orders.json，然后：
node tools/generate-resource.mjs orders   # 产出 表迁移 + RLS + API + CRUD 页 + 菜单
```
也可经 **MCP 工具**（`resource_generate` / `test_run` 等）由 AI 直接调用（见 `AGENTS.md`、`tools/mcp-server.mjs`）。

## 目录
```
api/      Fastify 后端（认证/RBAC/字段级/RLS/审计/资源路由）
web/      React + AntD 前端（/admin 管理后台 + /app 工作台）
db/       迁移（schema / RLS 自动生成）
deploy/   部署 / 备份 / 冒烟 / E2E
tools/    生成器 / MCP Server / 示例数据
cli/      create-derui-admin 脚手架 CLI
docs/     架构 / Agent Kit / 路线图 / Demo
```

## 文档
- 架构：`docs/architecture.md`
- Agent Kit：`docs/agent-kit.md`
- 路线图：`docs/roadmap.md`
- 本地 Demo：`docs/demos.md`
- 发布/维护：`docs/RELEASING.md`
- 变更日志：`CHANGELOG.md`

## 许可
**Apache-2.0**。见 `LICENSE` 与 `NOTICE`。
