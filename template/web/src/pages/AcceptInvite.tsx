import { Button, Card, Form, Input, message } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../api';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { user_name?: string; password: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/accept-invite', { token, ...values });
      message.success('已激活，请登录');
      navigate('/login');
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title="接受邀请" style={{ width: 380 }}>
        {!token ? (
          <p>链接无效：缺少 token。</p>
        ) : (
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="user_name" label="姓名（可选）">
              <Input />
            </Form.Item>
            <Form.Item name="password" label="设置密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              激活账号
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
