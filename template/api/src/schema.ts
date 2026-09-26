import { defineSchema, eqUser } from '@rls-kit/core';

/**
 * 单租户后台的访问模型（@rls-kit）。
 * - tenant_admin：运营管理后台，全权
 * - member     ：客户工作台，仅能看本租户数据；demo_item 仅能改自己名下
 *
 * 该模型同时用于：① 运行时 RBAC/字段级；② 生成 RLS DDL（scripts/generate-rls.ts）。
 */
export const schema = defineSchema({
  roles: ['tenant_admin', 'member'] as const,
  adminRole: 'tenant_admin',
  context: { tenant: 'tenant_id', user: 'user_id', role: 'role_type' },
  tables: {
    tenant: {
      isolateBy: 'id',
      roles: {
        tenant_admin: { all: true },
        member: { select: true },
      },
    },
    app_user: {
      roles: {
        tenant_admin: { all: true },
        member: { select: true },
      },
    },
    operation_log: {
      roles: {
        tenant_admin: { select: true, insert: true },
        member: { select: eqUser('operate_user_id'), insert: true },
      },
    },
    demo_item: {
      roles: {
        tenant_admin: { all: true },
        member: {
          select: true,
          insert: ['title', 'status'],
          update: ['title', 'status'],
          where: eqUser('owner_id'),
        },
      },
    },
    // <generated-resources>
  },
});

export type Role = (typeof schema.roles)[number];
