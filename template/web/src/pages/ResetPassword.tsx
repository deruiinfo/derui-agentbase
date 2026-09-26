import { Button, Card, Form, Input, message } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { new_password: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/password/reset', { token, new_password: values.new_password });
      message.success('密码已重置，请登录');
      navigate('/login');
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title="重置密码" style={{ width: 360 }}>
        {!token ? (
          <p>链接无效：缺少 token。</p>
        ) : (
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              提交
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
