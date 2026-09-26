# 路线图 · Derui AgentBase

> 原则：**分级推进**，避免一步到位。先 template（轻）→ CLI（起始套件）→ module generator（脚手架/护城河）。

## M0 立项 / 骨架（当前）
- [x] 定位、双轨关系、架构、抽取清单、目录树
- [x] 引擎 `@rls-kit` 归属：**发布 registry 按版本依赖**；已做成**可发布形态**（`tsc` build → `dist` + `.d.ts`，`exports`/`files` 就绪，`npm pack` 验证通过）
- [ ] 实际 `npm publish`（需私有 registry 凭据）
- [x] CLI 命名：`create-derui-admin`；发布渠道待定

## M1 template v0（可克隆即用）
- [x] 按 `docs/extraction-manifest.md` 执行减法抽取，产出 `template/`
- [x] 单租户 RLS 后台：登录 / 账号 / RBAC / 字段级 / 审计 / Docker 部署
- [x] 两个角色域 `/admin` + `/app`（含 `demo_item` 演示）
- [x] 本地验证：`api` 与 `web` 均 `tsc --noEmit` 通过；RLS DDL 由 schema 生成
- [x] **端到端：已在 VM210 `docker compose up` 跑通 + `e2e-docker.sh` 14/14 全绿**（隔离端口 5433/3101/8090）
- [x] 验收：`extraction-manifest.md` §7 核心项全绿

## M2 CLI（起始套件）
- [x] `cli/bin/create-derui-admin.mjs`：拷贝 template + 品牌替换（name/slug/port/包名/compose 名）+ 生成随机 `.env`
- [x] 本地实测通过（生成 `acme-console`：标题/Card/布局/包名/compose 名全部替换）
- [ ] 交互式初始化（可选）
- [ ] 发布渠道（`npm create` / 私有 npm）

## M3 · Agent Kit for Backend（护城河）
> 详见 `docs/agent-kit.md`（一页可执行方案）。产品不是"代码生成器"，而是"**给 AI agent 用的工具化基座**"。
- [x] `derui generate resource`：由 `resources/<name>.json` → 表迁移 + schema 规则 + 路由 + 注册 + 单表 RLS（**后端已实现**，orders E2E 10/10）
- [x] `AGENTS.md` + 机器可读约定（教 AI 怎么用、禁用项）
- [x] `generate:rls -- --table <name>`：**单表 RLS 自动生成**（消除手写与顺序坑）
- [x] 生成器产出**前端 CRUD 页 + 菜单/路由**（web 构建通过 + E2E 10/10）
- [x] **MCP Server**（零依赖 stdio）：`resource_list / resource_generate / typecheck / db_migrate / policy_preview / deploy_up`（`deploy_up` 需 confirm）
- [x] 用**真实业务模块**端到端复测（工单系统：客户+工单+状态流转，E2E 15/15）
- [x] 前端页支持**编辑/删除/状态快捷**（+ enum 下拉；E2E 16/16，member 删除 403 / admin 200）
- [ ] `@rls-kit` / CLI 对外发布；真实 MCP 客户端（Claude/Cursor）接入实测
- [x] **护栏**：DB 变更走迁移/工具、默认最小权限、`deploy_up` 需 confirm
- [x] **自检闭环**：`test_run` MCP 工具对资源跑权限矩阵（RLS/越权 404/注入 403），14/14
- **闸门**：实验已证明"契约+单表 RLS 生成"可行（customer 12/12、supplier 8/8）；下一步实现 `generate resource`。

## M4 · 账号生命周期补全（标准配置 · P0）✅ 已实现（E2E 11/11）
> 定位：**门票（hygiene），非特色**。低风险、纯增量，复用 `auth_token` + `Mailer` + 审计。
> 必要性：**登录日志**=企业安全审计标配；**邀请成员**=企业开通流程（管理员直接建号可兜底）。
> 明确**不做**：短信、IP 黑名单、refresh token（见评审；后置）。

### 4.1 登录日志（P0）
- **目标**：记录每次登录**成功/失败**（账号、IP、UA、时间、结果/原因），供管理员查询筛选。
- **范围**：迁移 `login_log`（tenant_id/user_id/login_account/result/ip/user_agent/created_at）；登录成功/失败/锁定处写入；`GET /api/login-logs`（仅管理员，分页+筛选）；前端「登录日志」页。
- **复用**：现有登录流程、审计页样式。
- **保留策略**：默认保留 90 天（后续可配），避免 PII 无限堆积。
- **验收**：成功/失败各生记录；管理员可查；非管理员 403；分页/筛选生效。

### 4.2 邀请成员（P0）
- **目标**：管理员按邮箱**邀请**成员 → 邮件带令牌 → 被邀者设密码后激活。
- **范围**：扩展 `auth_token.purpose`（+`invite`，迁移放开 CHECK）；`POST /api/users/invite`（管理员）；`POST /api/auth/accept-invite`（设密码→激活）；前端「接受邀请」页 + 账号管理「邀请」按钮。
- **复用**：`auth_token`（与找回密码同模式）+ `Mailer`（控制台/SMTP）；**防枚举**。
- **验收**：邀请→邮件(dev 回显链接)→接受→设密码→登录成功；令牌一次性/过期；未知邮箱静默成功。

### 前置决策
- 邮件通道：内网默认**控制台邮件**；生产配 SMTP。
- 邀请接受即视为邮箱已验证（不再单独做邮箱验证）。

## 验证门槛（先验证再投入）
1. template v0 + CLI 完成 → 找 **3 个「上不了云」的真实客户** demo。
2. **≥2 个愿付费** → 投入 M3 模块生成器；
3. 否则 → 保留为内部交付模板，不恋战。

## 风险
| 风险 | 应对 |
|------|------|
| 泛型 admin 脚手架红海 | 楔子＝on-prem + RLS + 审计 + 国产化部署 |
| `@rls-kit` 未发布导致依赖脆弱 | 先定引擎归属；优先发布 registry |
| 漂移 | 明确 template 为上游、实例为下游；通用改进回 template |
