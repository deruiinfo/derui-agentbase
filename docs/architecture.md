# 架构 · Derui AgentBase

> 定位：**单租户 · 私有化部署 · PostgreSQL 原生 RLS** 的后台脚手架。

---

## 1. 租户模型：单租户交付 + 多租户底座

- **交付形态＝单租户**：一套部署 = 一个组织；UI **隐藏**租户概念（无切换器、无租户管理台）。
- **架构底座＝多租户能力**：全表保留 `tenant_id` + RLS；初始化时创建一个默认租户。
- **理由**：on-prem 客户天然单租户；但保留 RLS 既满足差异化卖点，又为未来企业版（多租户）预留，**无需改表迁移**。

```
首次初始化 ──▶ 创建默认 tenant + 管理员
日常运行   ──▶ 每次请求注入 app.tenant_id（固定为默认租户），RLS 兜底隔离
未来企业版 ──▶ 开放租户管理/切换，RLS 策略无需改动
```

---

## 2. 两个角色域（一套应用，不是两套部署）

| 角色域 | 路由前缀 | 使用者 | 内容 | 脚手架提供 |
|--------|----------|--------|------|-----------|
| **运营管理后台** | `/admin/*` | tenant_admin | 账号、角色、审计日志、系统设置 | ✅ 完整 |
| **客户工作台** | `/app/*` | member / 业务角色 | 各自业务数据 + 按权限过滤 | ⚠️ 最小骨架 + 权限演示（业务留空） |

- 同后端、同前端应用，按 **角色 + 路由前缀** 划分，**不做两套部署**（单租户下两套 = 维护地狱）。
- 演示用：工作台内置一个 `demo_item` 实体，演示「列表按权限过滤 + 详情 + 新建 + 审计」。

> 若未来需要「客户的客户」登录（B 端门户），属另一产品形态，**不在本脚手架范围**。

---

## 3. 三层权限（复用 `@rls-kit`）

```
请求 → ① RBAC（@rls-kit/fastify 的 can(table, action) preHandler）
     → ② 字段级（@rls-kit pick() 按 insert/update 列白名单裁剪）
     → ③ RLS 行级（PostgreSQL 策略读 current_setting('app.*')）
     → SQL
```

| 层 | 实现 | 组件 |
|----|------|------|
| RBAC | Fastify preHandler | `@rls-kit/fastify` `can()` |
| 字段级 | 应用层强制（前端置灰仅交互） | `@rls-kit` `pick()` |
| 行级 | PG RLS，`SET LOCAL app.*` | `@rls-kit/core` `withContext()` + `toRlsSql()` |
| 审计 | 每次写操作落 `operation_log` | `@rls-kit/fastify` `audit()` |

**连接池纪律**（Rule）：业务查询必须走 `appUrl`（非 owner / `NOBYPASSRLS`）；登录/后台走 `adminUrl`（BYPASSRLS）。否则 RLS 静默失效。

---

## 4. 数据模型（最小集）

| 表 | 用途 | 关键字段 |
|----|------|----------|
| `tenant` | 租户（默认 1 行） | id, tenant_name, config_json |
| `app_user` | 用户 | id, tenant_id, login_account(unique), password_hash, role_type, user_status |
| `operation_log` | 审计（不可改删） | id, tenant_id, operate_user_id, operate_type, source_type, source_id, diff_json, created_at |
| `demo_item` | **演示实体**（可删） | id, tenant_id, version, title, status, owner_id |

> 通则：uuid 主键、`tenant_id` 隔离、`version` 乐观锁、`timestamptz`、外键 `ON DELETE RESTRICT`（禁 CASCADE）。

RLS 策略由 `@rls-kit` 的 `schema.toRlsSql()` 生成，不手写。

---

## 5. 请求链路

```
浏览器（React+AntD）
   │ Authorization: Bearer <JWT>
   ▼
Fastify API
   ├─ authenticate（@rls-kit）→ 注入 req.rlsCtx
   ├─ can(table, action)（RBAC）
   ├─ pick(body)（字段级）
   ├─ withContext → BEGIN; SET LOCAL app.tenant_id/user_id/role_type; …; COMMIT
   ├─ audit（operation_log）
   ▼
PostgreSQL 16（RLS 兜底）
```
