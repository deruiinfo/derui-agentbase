# 本地 Demo 指引 · Derui AgentBase

> 在本地/自有主机上快速起一个 Demo，理解"这是什么、怎么用"。
> 无需内网环境；用仓库自带模板即可。

## 起一个 Demo
```bash
cd template
cp .env.example .env          # 修改数据库密码 / JWT 密钥
docker compose up -d --build
```
访问：`http://127.0.0.1:${WEB_PORT}`（默认 8080）
初始账号：`.env` 的 `ADMIN_ACCOUNT` / `ADMIN_PASSWORD`（**首次登录后请修改**）。

## 体验路径
1. 用管理员登录 → 左侧菜单「账号管理 / 操作日志 / 登录日志 / SSO 设置 / 客户工作台」。
2. 新建一个成员账号；用**无痕窗口**以该成员登录 → 菜单变少，且**改不属于自己的记录会失败**（行级权限）。
3. 「操作日志」「登录日志」查看审计与登录留痕（含导出 CSV）。
4. 「SSO 设置」配置 OIDC（Discovery + 连接测试 + Claim/组→角色映射）。
5. 登录页「忘记密码？」走找回流程；右上角「两步验证」开启 TOTP。
6. 「账号管理」→「邀请成员」走邀请-接受流程。

## 生成一个业务资源（AI 原生）
```bash
# 写一行 resources/customers.json：
# { "name":"customers", "fields":[{"name":"name","type":"text","required":true}], "member": { "seeAll": false, "writable": ["name"] } }
node tools/generate-resource.mjs customers
docker compose up -d --build
```

## 灌示例数据（可选）
```bash
cd template && BASE_URL=http://127.0.0.1:8080 node tools/seed-demo.mjs
```

## 说明
- 单租户交付 + RLS 多租户底座；数据 100% 自有硬件。
- 其它文档：`docs/architecture.md`、`docs/agent-kit.md`、`docs/roadmap.md`。
