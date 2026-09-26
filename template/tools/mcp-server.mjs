#!/usr/bin/env node
/**
 * derui-admin MCP Server（零依赖 · stdio · JSON-RPC 2.0）
 * 把基座的安全操作暴露为 MCP 工具，供任意 AI agent 调用（Claude/Cursor/opencode…）。
 *
 * 运行：在项目根目录 `node tools/mcp-server.mjs`
 * 注册（客户端示例见 tools/mcp.example.json）：
 *   { "mcpServers": { "derui-admin": { "command": "node", "args": ["tools/mcp-server.mjs"] } } }
 *
 * 护栏：所有 DB 变更只经工具；破坏性操作（deploy）需 confirm=true。
 */
import { createInterface } from 'node:readline';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const API = join(ROOT, 'api');
const DB = join(ROOT, 'db', 'migrations');

function run(cmd, cwd = ROOT) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', timeout: 10 * 60 * 1000 });
  return `$ ${cmd}\n${r.stdout ?? ''}${r.stderr ? '\n[stderr] ' + r.stderr : ''}\n[exit ${r.status}]`;
}

const TOOLS = [
  {
    name: 'resource_list',
    description: '列出已声明的资源（resources/*.json）',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'resource_generate',
    description:
      '生成一个业务资源：表迁移 + schema 规则 + 路由 + 注册 + 单表 RLS + 前端页 + 菜单/路由。可传 spec 覆盖，否则用 resources/<name>.json。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '资源名（snake_case、复数，如 orders）' },
        spec: { type: 'object', description: '可选：资源声明（fields/member）' },
      },
      required: ['name'],
    },
  },
  {
    name: 'typecheck',
    description: '对 api 与 web 运行 tsc --noEmit，返回结果',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'db_migrate',
    description: '应用数据库迁移（需 DATABASE_URL_* 环境变量）',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'policy_preview',
    description: '预览某资源的 RLS 策略 SQL',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'deploy_up',
    description: 'docker compose up -d --build（破坏性，需 confirm=true）',
    inputSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] },
  },
  {
    name: 'test_run',
    description:
      '对资源跑权限自检：admin/member 建单、RLS 隔离、越权 404、字段注入 403。需环境变量 BASE_URL（默认 http://127.0.0.1:3001）、ADMIN_ACCOUNT/ADMIN_PASSWORD。',
    inputSchema: { type: 'object', properties: { base: { type: 'string' } }, required: [] },
  },
];

function text(s, isError = false) {
  return { content: [{ type: 'text', text: String(s) }], isError };
}

async function http(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

/** 权限自检：对 resources/*.json 逐个跑 admin/member/RLS/字段级 */
async function runResourceTests(baseArg) {
  const base = baseArg || process.env.BASE_URL || 'http://127.0.0.1:3001';
  const acc = process.env.ADMIN_ACCOUNT || 'admin';
  const pw = process.env.ADMIN_PASSWORD || 'change-me';
  const dir = join(ROOT, 'resources');
  if (!existsSync(dir)) return text('no resources/ to test', true);

  const log = [];
  let pass = 0;
  let fail = 0;
  const chk = (n, exp, got) => {
    if (String(exp) === String(got)) {
      pass++;
      log.push(`PASS  ${n}`);
    } else {
      fail++;
      log.push(`FAIL  ${n} (exp ${exp} got ${got})`);
    }
  };

  const al = await http('POST', `${base}/api/auth/login`, null, { login_account: acc, password: pw });
  const at = al.json?.data?.token;
  chk('admin login', 'yes', at ? 'yes' : 'no');
  if (!at) return text(log.join('\n'), true);

  const mac = 'e2e_member';
  await http('POST', `${base}/api/users`, at, { user_name: 'E2E', login_account: mac, password: 'Test-12345', role_type: 'member' });
  const ml = await http('POST', `${base}/api/auth/login`, null, { login_account: mac, password: 'Test-12345' });
  const mt = ml.json?.data?.token;
  chk('member login', 'yes', mt ? 'yes' : 'no');
  if (!mt) return text(log.join('\n'), true);

  const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  for (const name of names) {
    const spec = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
    const f0 = spec.fields?.[0]?.name || 'title';
    const aCreate = await http('POST', `${base}/api/${name}`, at, { [f0]: `A-${name}` });
    chk(`${name}: admin create`, 200, aCreate.status);
    const aid = aCreate.json?.data?.id;
    const mCreate = await http('POST', `${base}/api/${name}`, mt, { [f0]: `M-${name}` });
    chk(`${name}: member create`, 200, mCreate.status);
    const mid = mCreate.json?.data?.id;
    chk(`${name}: member list 200`, 200, (await http('GET', `${base}/api/${name}`, mt)).status);
    chk(`${name}: member update others -> 404`, 404, (await http('PATCH', `${base}/api/${name}/${aid}`, mt, { [f0]: 'x' })).status);
    chk(`${name}: member update own -> 200`, 200, (await http('PATCH', `${base}/api/${name}/${mid}`, mt, { [f0]: 'y' })).status);
    chk(`${name}: field inject -> 403`, 403, (await http('POST', `${base}/api/${name}`, mt, { [f0]: 'z', tenant_id: '00000000-0000-0000-0000-000000000000' })).status);
    if (mid) await http('DELETE', `${base}/api/${name}/${mid}`, at);
    if (aid) await http('DELETE', `${base}/api/${name}/${aid}`, at);
  }
  log.push('----', `PASS=${pass} FAIL=${fail}`);
  return text(log.join('\n'), fail > 0);
}

async function callTool(name, a = {}) {
  switch (name) {
    case 'resource_list': {
      const dir = join(ROOT, 'resources');
      if (!existsSync(dir)) return text('(no resources/)');
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return text(files.map((f) => f.replace(/\.json$/, '')).join('\n') || '(empty)');
    }
    case 'resource_generate': {
      if (!a.name) return text('name required', true);
      if (a.spec) {
        mkdirSync(join(ROOT, 'resources'), { recursive: true });
        writeFileSync(join(ROOT, 'resources', `${a.name}.json`), JSON.stringify(a.spec, null, 2) + '\n', 'utf8');
      }
      return text(run(`node tools/generate-resource.mjs ${a.name}`));
    }
    case 'typecheck': {
      const api = run('npx tsc --noEmit', API);
      const web = existsSync(join(ROOT, 'web', 'node_modules')) ? run('npx tsc --noEmit', join(ROOT, 'web')) : '(web deps not installed; skipped)';
      return text(`== api ==\n${api}\n== web ==\n${web}`);
    }
    case 'db_migrate':
      return text(run('npm run migrate', API));
    case 'policy_preview': {
      if (!existsSync(DB)) return text('(no db/migrations)', true);
      const f = readdirSync(DB).find((x) => new RegExp(`_rls_${a.name}\\.sql$`).test(x));
      return f ? text(readFileSync(join(DB, f), 'utf8')) : text(`no RLS migration for "${a.name}"`, true);
    }
    case 'deploy_up':
      if (a.confirm !== true) return text('deploy_up requires confirm=true', true);
      return text(run('docker compose up -d --build'));
    case 'test_run':
      return runResourceTests(a.base);
    default:
      return text(`unknown tool: ${name}`, true);
  }
}

// ---- JSON-RPC over stdio ----
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  const s = line.trim();
  if (!s) return;
  let req;
  try {
    req = JSON.parse(s);
  } catch {
    return;
  }
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'derui-admin-kit', version: '0.1.0' },
        },
      });
    }
    if (method === 'notifications/initialized' || method === 'initialized') return; // notification, no reply
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      const out = await callTool(params?.name, params?.arguments ?? {});
      return send({ jsonrpc: '2.0', id, result: out });
    }
    if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found' } });
  } catch (e) {
    if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e?.message ?? e) } });
  }
});
