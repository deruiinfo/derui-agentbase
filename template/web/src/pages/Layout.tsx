import { useState } from 'react';
import { Layout as AntLayout, Button, Form, Input, Menu, Modal, Space, Typography, message } from 'antd';
import { AppstoreOutlined, FileTextOutlined, LoginOutlined, LogoutOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, errMsg, type Me } from '../api';
import Users from './Users';
import Logs from './Logs';
import LoginLogs from './LoginLogs';
import DemoItems from './DemoItems';
import OidcSettings from './OidcSettings';
// <generated:web-imports>

const { Header, Sider, Content } = AntLayout;

export default function AppLayout({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const isAdmin = me.role_type === 'tenant_admin';
  const navigate = useNavigate();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [form] = Form.useForm();

  const items = [
    ...(isAdmin
      ? [
          { key: '/admin/users', icon: <TeamOutlined />, label: '账号管理' },
          { key: '/admin/logs', icon: <FileTextOutlined />, label: '操作日志' },
          { key: '/admin/login-logs', icon: <LoginOutlined />, label: '登录日志' },
          { key: '/admin/oidc', icon: <SafetyOutlined />, label: 'SSO 设置' },
        ]
      : []),
    { key: '/app', icon: <AppstoreOutlined />, label: '客户工作台' },
    // <generated:menu>
  ];

  const changePassword = async () => {
    const v = await form.validateFields();
    try {
      await api.post('/auth/change-password', v);
      message.success('密码已修改');
      setPwOpen(false);
      form.resetFields();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [twoFaUrl, setTwoFaUrl] = useState<string | null>(null);
  const [twoFaForm] = Form.useForm();

  const openTwoFa = async () => {
    setTwoFaOpen(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      setTwoFaSecret(res.data.data.secret);
      setTwoFaUrl(res.data.data.otpauth_url);
    } catch (e) {
      message.error(errMsg(e));
    }
  };
  const submitTwoFa = async () => {
    const v = await twoFaForm.validateFields();
    try {
      await api.post('/auth/2fa/enable', { code: v.code });
      message.success('两步验证已开启');
      setTwoFaOpen(false);
      twoFaForm.resetFields();
    } catch (e) {
      message.error(errMsg(e));
    }
  };
  const disableTwoFa = async () => {
    const v = await twoFaForm.validateFields();
    try {
      await api.post('/auth/2fa/disable', { code: v.code });
      message.success('两步验证已关闭');
      setTwoFaOpen(false);
      twoFaForm.resetFields();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark">
        <div style={{ color: '#fff', padding: 16, fontWeight: 600 }}>Admin Console</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(e) => navigate(e.key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingInline: 24 }}>
          <Typography.Text strong>{isAdmin ? '运营管理后台' : '客户工作台'}</Typography.Text>
          <Space>
            <Typography.Text>
              {me.user?.user_name}（{isAdmin ? '管理员' : '成员'}）
            </Typography.Text>
            <Button size="small" onClick={openTwoFa}>
              两步验证
            </Button>
            <Button size="small" onClick={() => setPwOpen(true)}>
              修改密码
            </Button>
            <Button size="small" icon={<LogoutOutlined />} onClick={onLogout}>
              退出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Routes>
            <Route path="/app" element={<DemoItems me={me} />} />
            {isAdmin && <Route path="/admin/users" element={<Users />} />}
            {isAdmin && <Route path="/admin/logs" element={<Logs />} />}
            {isAdmin && <Route path="/admin/login-logs" element={<LoginLogs />} />}
            {isAdmin && <Route path="/admin/oidc" element={<OidcSettings />} />}
            {/* <generated:web-routes> */}
            <Route path="*" element={<Navigate to={isAdmin ? '/admin/users' : '/app'} replace />} />
          </Routes>
        </Content>
      </AntLayout>

      <Modal open={pwOpen} title="修改密码" onOk={changePassword} onCancel={() => setPwOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="old_password" label="原密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={twoFaOpen}
        title="两步验证"
        onCancel={() => {
          setTwoFaOpen(false);
          twoFaForm.resetFields();
        }}
        footer={
          me.user?.two_factor_enabled
            ? [
                <Button key="d" danger onClick={disableTwoFa}>
                  关闭两步验证
                </Button>,
                <Button key="c" onClick={() => setTwoFaOpen(false)}>
                  取消
                </Button>,
              ]
            : [
                <Button key="c" onClick={() => setTwoFaOpen(false)}>
                  取消
                </Button>,
                <Button key="ok" type="primary" onClick={submitTwoFa}>
                  开启
                </Button>,
              ]
        }
      >
        {me.user?.two_factor_enabled ? (
          <Form form={twoFaForm} layout="vertical">
            <p>两步验证已开启。输入当前验证码以关闭：</p>
            <Form.Item name="code" label="验证码" rules={[{ required: true }]}>
              <Input maxLength={6} />
            </Form.Item>
          </Form>
        ) : (
          <Form form={twoFaForm} layout="vertical">
            <p>用验证器 App（Google/Microsoft Authenticator）添加以下密钥，再输入验证码开启：</p>
            <Typography.Paragraph copyable>{twoFaSecret}</Typography.Paragraph>
            <Typography.Paragraph copyable type="secondary" style={{ wordBreak: 'break-all' }}>
              {twoFaUrl}
            </Typography.Paragraph>
            <Form.Item name="code" label="验证码" rules={[{ required: true }]}>
              <Input maxLength={6} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </AntLayout>
  );
}
