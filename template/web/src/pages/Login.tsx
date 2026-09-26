import { Button, Card, Divider, Form, Input, Modal, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api, errMsg, fetchMe, TOKEN_KEY, type Me } from '../api';

export default function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [loading, setLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [forgotForm] = Form.useForm();

  const finish = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    onLogin(await fetchMe());
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oidcToken = params.get('oidc_token');
    const oidcError = params.get('oidc_error');
    if (oidcToken) {
      void finish(oidcToken);
    } else if (oidcError) {
      message.error(`SSO 登录失败：${oidcError}`);
    }
    api
      .get('/auth/oidc/enabled')
      .then((res) => setOidcEnabled(Boolean(res.data?.data?.enabled)))
      .catch(() => {});
  }, []);

  const onFinish = async (values: { login_account: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', values);
      const data = res.data.data;
      if (data.mfa_required) setMfaToken(data.mfa_token);
      else await finish(data.token);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const onMfa = async (values: { code: string }) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login/2fa', { mfa_token: mfaToken, code: values.code });
      await finish(res.data.data.token);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const sendForgot = async () => {
    const v = await forgotForm.validateFields();
    setDevLink(null);
    try {
      const res = await api.post('/auth/password/forgot', v);
      setDevLink(res.data?.data?.reset_link ?? null);
      message.success('若账号存在，重置链接已发送');
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title="Admin Console" style={{ width: 360 }}>
        {mfaToken ? (
          <Form layout="vertical" onFinish={onMfa}>
            <Form.Item name="code" label="两步验证码" rules={[{ required: true }]}>
              <Input maxLength={6} placeholder="6 位验证码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              验证
            </Button>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Typography.Link onClick={() => setMfaToken(null)}>返回</Typography.Link>
            </div>
          </Form>
        ) : (
          <>
            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item name="login_account" label="账号" rules={[{ required: true }]}>
                <Input autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登录
              </Button>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Typography.Link onClick={() => setForgotOpen(true)}>忘记密码？</Typography.Link>
              </div>
            </Form>
            {oidcEnabled && (
              <>
                <Divider plain>或</Divider>
                <Button block onClick={() => (window.location.href = '/api/auth/oidc/start')}>
                  使用 SSO 登录
                </Button>
              </>
            )}
          </>
        )}
      </Card>

      <Modal
        open={forgotOpen}
        title="找回密码"
        onOk={sendForgot}
        onCancel={() => {
          setForgotOpen(false);
          setDevLink(null);
          forgotForm.resetFields();
        }}
      >
        <Form form={forgotForm} layout="vertical">
          <Form.Item name="login_account" label="账号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {devLink && (
            <Typography.Paragraph copyable style={{ color: '#1677ff', wordBreak: 'break-all' }}>
              {devLink}
            </Typography.Paragraph>
          )}
        </Form>
      </Modal>
    </div>
  );
}
