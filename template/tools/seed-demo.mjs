#!/usr/bin/env node
/**
 * seed-demo — 通过 API 灌入示例数据，让 demo 一打开就有内容。
 * 用法： BASE_URL=http://127.0.0.1:8410 ADMIN_PASSWORD=change-me node tools/seed-demo.mjs
 * 逻辑：登录 admin → 建一个演示成员 → 对 resources/*.json 各建若干行（部分归成员）；
 *       若无 resources/，则给内置 demo-items 灌数据。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ACC = process.env.ADMIN_ACCOUNT || 'admin';
const PW = process.env.ADMIN_PASSWORD || 'change-me';
const MEMBER = process.env.DEMO_MEMBER || 'demo_member';
const MPW = process.env.DEMO_MEMBER_PASSWORD || 'Test-12345';

const SAMPLES = {
  name: ['阿里巴巴', '腾讯科技', '字节跳动', '美团', '京东', '拼多多'],
  company: ['Alibaba Group', 'Tencent', 'ByteDance', 'Meituan', 'JD.com'],
  phone: ['13800000001', '13800000002', '13800000003', '13800000004'],
  email: ['a@demo.com', 'b@demo.com', 'c@demo.com'],
  title: ['无法登录后台', '订单导出失败', '支付回调异常', '页面样式错乱', '账号权限申请', '数据同步延迟'],
  subject: ['登录问题', '导出失败', '支付异常', '样式问题', '权限申请'],
  description: ['复现步骤：登录后点击导出，无响应。', '用户反馈移动端样式错乱。', '支付回调偶发 500。', '需要开通子账号权限。'],
  contact: ['张三', '李四', '王五', '赵六'],
};

async function http(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

function valueFor(field, i, idMap) {
  if (Array.isArray(field.enum)) return field.enum[i % field.enum.length];
  const ref = field.name.match(/^(.*)_id$/);
  if (ref && idMap[ref[1]]?.length) return idMap[ref[1]][i % idMap[ref[1]].length];
  if (/name/i.test(field.name) && SAMPLES.name) return SAMPLES.name[i % SAMPLES.name.length];
  if (/company/i.test(field.name)) return SAMPLES.company[i % SAMPLES.company.length];
  if (/phone|mobile|tel/i.test(field.name)) return SAMPLES.phone[i % SAMPLES.phone.length];
  if (/email/i.test(field.name)) return SAMPLES.email[i % SAMPLES.email.length];
  if (/contact/i.test(field.name)) return SAMPLES.contact[i % SAMPLES.contact.length];
  if (/title|subject/i.test(field.name)) return SAMPLES.title[i % SAMPLES.title.length];
  if (/desc|note|remark/i.test(field.name)) return SAMPLES.description[i % SAMPLES.description.length];
  if (field.type === 'numeric') return (i + 1) * 100;
  if (field.type === 'uuid') return undefined;
  return `示例${i + 1}`;
}

async function main() {
  const al = await http('POST', '/api/auth/login', null, { login_account: ACC, password: PW });
  const at = al.json?.data?.token;
  if (!at) {
    console.error('admin login failed', al.status, al.json);
    process.exit(1);
  }
  // 演示成员
  await http('POST', '/api/users', at, { user_name: '演示成员', login_account: MEMBER, password: MPW, role_type: 'member' });
  const ml = await http('POST', '/api/auth/login', null, { login_account: MEMBER, password: MPW });
  const mt = ml.json?.data?.token;

  const dir = join(process.cwd(), 'resources');
  const idMap = {};
  let total = 0;

  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const spec = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const name = spec.name ?? file.replace(/\.json$/, '');
      const fields = spec.fields ?? [];
      const ids = [];
      const plan = [
        { token: at, n: 4 },
        ...(mt ? [{ token: mt, n: 2 }] : []),
      ];
      let i = 0;
      for (const p of plan) {
        for (let k = 0; k < p.n; k++, i++) {
          const body = {};
          for (const f of fields) {
            const v = valueFor(f, i, idMap);
            if (v !== undefined) body[f.name] = v;
          }
          const r = await http('POST', `/api/${name}`, p.token, body);
          if (r.json?.data?.id) ids.push(r.json.data.id);
          total++;
        }
      }
      idMap[name] = ids;
      console.log(`seeded ${name}: ${ids.length}`);
    }
  } else {
    // 无 resources：给内置 demo-items 灌数据
    const titles = SAMPLES.title;
    for (let i = 0; i < 5; i++) {
      await http('POST', '/api/demo-items', at, { title: titles[i % titles.length] });
      total++;
    }
    if (mt) await http('POST', '/api/demo-items', mt, { title: '我的示例记录' });
    console.log('seeded demo-items');
  }
  console.log(`done. total requests ~${total}. login: ${ACC}/${PW} + ${MEMBER}/${MPW}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
