import { Button, Card, Form, Input, Switch, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api, errMsg } from '../api';

const PRESETS: Record<string, string> = {
  Keycloak: 'https://<keycloak-host>/realms/<realm>',
  'Entra ID': 'https://login.microsoftonline.com/<tenant-id>/v2.0',
  Google: 'https://accounts.google.com',
  Casdoor: 'https://<casdoor-host>',
};

export default function OidcSettings() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [endpoints, setEndpoints] = useState<Record<string, string> | null>(null);
  const [redirectUri, setRedirectUri] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/admin/oidc');
      const d = res.data.data;
      setRedirectUri(d.redirect_uri ?? '');
      form.setFieldsValue({
        enabled: d.enabled ?? false,
        issuer_url: d.issuer_url ?? '',
        client_id: d.client_id ?? '',
        scopes: d.scopes ?? 'openid email profile',
        claim_username: d.claim_username ?? 'preferred_username',
        claim_email: d.claim_email ?? 'email',
        claim_groups: d.claim_groups ?? 'groups',
        default_role: d.default_role ?? 'member',
        group_role_map: JSON.stringify(d.group_role_map ?? {}, null, 2),
      });
    } catch (e) {
      message.error(errMsg(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const test = async () => {
    const issuer = form.getFieldValue('issuer_url');
    setTesting(true);
    setEndpoints(null);
    try {
      const res = await api.post('/admin/oidc/test', { issuer_url: issuer });
      const d = res.data.data;
      if (d.ok) {
        setEndpoints(d.endpoints);
        message.success('Discovery 成功');
      } else {
        message.error(d.error);
      }
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const v = await form.validateFields();
    let groupMap = {};
    if (v.group_role_map) {
      try {
        groupMap = JSON.parse(v.group_role_map);
      } catch {
        return message.error('组→角色映射不是合法 JSON');
      }
    }
    setSaving(true);
    try {
      await api.put('/admin/oidc', { ...v, group_role_map: groupMap });
      message.success('已保存');
      void load();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="SSO / OIDC 设置" style={{ maxWidth: 720 }}>
      <Form form={form} layout="vertical">
        <Form.Item name="enabled" label="启用 SSO" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="Issuer URL" required>
          <Form.Item name="issuer_url" noStyle rules={[{ required: true }]}>
            <Input placeholder="https://idp.example.com/realms/main" />
          </Form.Item>
        </Form.Item>
        <div style={{ marginBottom: 12 }}>
          预设：
          {Object.entries(PRESETS).map(([name, url]) => (
            <Button key={name} size="small" type="link" onClick={() => form.setFieldsValue({ issuer_url: url })}>
              {name}
            </Button>
          ))}
        </div>
        <Button onClick={test} loading={testing} style={{ marginBottom: 12 }}>
          连接测试（Discovery）
        </Button>
        {endpoints && (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            authorization: {endpoints.authorization_endpoint}
            <br />
            token: {endpoints.token_endpoint}
            <br />
            jwks: {endpoints.jwks_uri}
          </Typography.Paragraph>
        )}

        <Form.Item name="client_id" label="Client ID" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="client_secret" label="Client Secret（留空=不修改）">
          <Input.Password />
        </Form.Item>
        <Form.Item name="scopes" label="Scopes">
          <Input />
        </Form.Item>
        <Form.Item label="回调地址（复制到 IdP 白名单）">
          <Input value={redirectUri} readOnly />
        </Form.Item>

        <Form.Item name="claim_username" label="用户名 Claim">
          <Input />
        </Form.Item>
        <Form.Item name="claim_email" label="邮箱 Claim">
          <Input />
        </Form.Item>
        <Form.Item name="claim_groups" label="组 Claim">
          <Input />
        </Form.Item>
        <Form.Item name="default_role" label="默认角色">
          <Input />
        </Form.Item>
        <Form.Item name="group_role_map" label="组→角色映射（JSON）">
          <Input.TextArea rows={4} placeholder='{"admins":"tenant_admin"}' />
        </Form.Item>

        <Button type="primary" onClick={save} loading={saving}>
          保存
        </Button>
      </Form>
    </Card>
  );
}
