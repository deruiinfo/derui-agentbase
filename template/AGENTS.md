# AGENTS.md — 给 AI agent 的开发约定（Derui AgentBase 基座）

> 本文件是 AI 在本基座上新增/修改业务资源的**唯一约定入口**。严格按此执行，勿自由发挥。

## 0. 基座概述
- 后端 Fastify + PostgreSQL 16 + **RLS（@rls-kit）**；三层权限：**RBAC + 字段级 + RLS**；写操作审计。
- 角色：`tenant_admin`（管理员，全权）/ `member`（成员）。

```
api/src/schema.ts        ← 访问模型（角色×表×动作）：RLS/RBAC/字段级的唯一真相
api/src/routes/*.ts      ← 路由（每资源一个文件，参照 demo-items.ts）
api/src/server.ts        ← 注册路由 + @rls-kit 插件
db/migrations/*.sql      ← 迁移（按编号顺序执行；表迁移编号 < RLS 迁移编号）
web/src/pages/*.tsx      ← 前端页
web/src/pages/Layout.tsx ← 菜单/路由
```

## 1. 新增一个资源 —— 5 步，勿跳步
> **推荐（Agent Kit）**：先写 `resources/<name>.json`，再跑
> `node tools/generate-resource.mjs <name>` —— 自动生成 **表迁移 + schema 规则 + 路由(GET/POST/PATCH/DELETE) + server 注册 + 单表 RLS + 前端 CRUD 页(列表/搜索/分页/新建/编辑/删除/状态快捷) + 菜单/路由**。
> 字段支持 `enum: [...]`（表单下拉、表格标签；名为 `status` 的字段在表格内可快捷改状态）；`required: true` → 表单必填校验。
> 基座另含：审计日志页 + **导出 CSV**；**登录日志**（`GET /api/login-logs`，仅管理员）；**找回密码**（`/api/auth/password/forgot` / `/reset` + `Mailer`）；**邀请成员**（`POST /api/users/invite` + `POST /api/auth/accept-invite`）；**两步验证 TOTP**（`/api/auth/2fa/setup|enable|disable`，登录二段 `/api/auth/login/2fa`）；**OIDC SSO**（管理端「SSO 设置」配置栏；`/api/auth/oidc/start|callback`）。
> 声明格式：
> ```json
> { "name": "order", "fields": [ {"name":"title","type":"text"}, {"name":"amount","type":"numeric"} ], "member": { "seeAll": false, "writable": ["title","amount"] } }
> ```
> 下面 5 步为**手动兜底 / 理解原理**。

资源名 `<name>`（小写复数，如 `suppliers`），表名同名。

### 步骤 1：`api/src/schema.ts` 加表规则
```ts
<name>: {
  roles: {
    tenant_admin: { all: true },
    member: {
      select: eqUser('owner_id'),   // 行可见性：eqUser=仅本人；true=全租户可见
      insert: ['colA','colB'],      // 字段级：必须显式列白名单（禁止 true）
      update: ['colA','colB'],
      where: eqUser('owner_id'),    // 写操作附加行谓词（本人名下）
    },
  },
},
```

### 步骤 2：建表迁移 `db/migrations/00NN_<name>.sql`（取当前最大编号 +1）
```sql
create table public.<name> (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete restrict,
  version int not null default 1,
  -- 业务列…
  owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_<name>_tenant on public.<name>(tenant_id);
create trigger trg_<name>_updated before update on public.<name>
  for each row execute function public.set_updated_at();
```

### 步骤 3：生成 RLS 迁移（**先建表，再生成**）
```bash
cd api && npm run generate:rls -- --table <name>
# → 自动生成 db/migrations/00MM_rls_<name>.sql（含该表策略）
```
> ⚠️ 不要用 `npm run generate:rls`（无参=全部表，会把策略建到尚未创建的表上）。

### 步骤 4：路由 `api/src/routes/<name>.ts`（参照 `demo-items.ts` / `customers.ts`）
- GET 列表：`[app.rlsKit.authenticate, app.rlsKit.can('<name>','select')]` + `withContext` 查询
- POST：`can('<name>','insert')` + `pick(body,'<name>','insert',role,{reject:true})` + 写入 `owner_id = ctx.user_id` + `audit`
- PATCH：`can('<name>','update')` + `pick(...)` 组织 SET + `audit`
- **越权/不存在 → 404**；字段越权（pick reject）→ **403**。
- **禁止**：手写 SQL 绕过 RLS；**禁止**不写 audit。

### 步骤 5：注册 `api/src/server.ts`
```ts
import { register<Name> } from './routes/<name>.ts';
register<Name>(app);
```

### （可选）步骤 6：前端页
复制 `web/src/pages/DemoItems.tsx` → `<Name>s.tsx`，改接口路径；`Layout.tsx` 加菜单与路由。

## 2. 命令
| 目的 | 命令 |
|---|---|
| 类型检查 | `cd api && npx tsc --noEmit`（必须 0 error） |
| 迁移 | `npm run migrate`（容器启动自动执行） |
| 生成单表 RLS | `npm run generate:rls -- --table <name>` |
| 部署 | `docker compose up -d --build` |
| 端到端 | `BASE_URL=... bash deploy/e2e-docker.sh` |

## 3. 硬性规则（违反即失败）
1. 字段级**必须显式列白名单**，禁止 `true`。
2. 行可见性 → `select`；本人归属 → `where: eqUser('owner_id')`。
3. **表迁移编号 < RLS 迁移编号**；RLS 不得建在未建的表上。
4. 所有表结构变更走迁移；**禁止**在路由里 `create/alter table`。
5. 写操作**必须** audit。
6. 完成后必须 `tsc` 通过 + E2E 通过。

## 4. 自检清单
- [ ] schema.ts 已加规则且字段为白名单
- [ ] 表迁移 + 单表 RLS 迁移（编号递增）
- [ ] 路由（select/insert/update）+ server 注册
- [ ] `tsc` 0 error
- [ ] E2E：member 仅见/改本人（或按 select 规则）· 越权 404 · 字段注入 403 · 审计有记录

## 5. MCP 工具（推荐：AI 直接调用，而非敲命令）
启动：`node tools/mcp-server.mjs`（stdio，零依赖）。注册示例见 `tools/mcp.example.json`。

| 工具 | 作用 |
|---|---|
| `resource_list` | 列出资源 |
| `resource_generate {name, spec?}` | 生成全栈资源（迁移+schema+路由+注册+RLS+前端页+菜单） |
| `typecheck` | api/web `tsc --noEmit` |
| `db_migrate` | 应用迁移 |
| `policy_preview {name}` | 预览某资源 RLS SQL |
| `test_run {base?}` | **权限自检**：对 `resources/*` 跑 admin/member 建单 · RLS 隔离 · 越权 404 · 注入 403 |
| `deploy_up {confirm:true}` | `docker compose up -d --build`（破坏性） |

**护栏**：所有 DB 变更只经工具；`deploy_up` 需 `confirm=true`。
