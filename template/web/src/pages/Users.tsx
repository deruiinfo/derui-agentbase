import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { api, errMsg, type User } from '../api';

export default function Users() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm] = Form.useForm();
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setRows(res.data.data);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/users', values);
      message.success('已创建');
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const invite = async () => {
    const values = await inviteForm.validateFields();
    setInviteLink(null);
    try {
      const res = await api.post('/users/invite', values);
      setInviteLink(res.data?.data?.invite_link ?? null);
      message.success('邀请已发送');
      void load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await api.patch(`/users/${id}`, body);
      message.success('已更新');
      void load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          新建账号
        </Button>
        <Button onClick={() => setInviteOpen(true)}>邀请成员</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '姓名', dataIndex: 'user_name' },
          { title: '登录账号', dataIndex: 'login_account' },
          {
            title: '角色',
            dataIndex: 'role_type',
            render: (v: string, row) => (
              <Select
                size="small"
                value={v}
                style={{ width: 110 }}
                onChange={(role_type) => patch(row.id, { role_type })}
                options={[
                  { value: 'member', label: '成员' },
                  { value: 'tenant_admin', label: '管理员' },
                ]}
              />
            ),
          },
          {
            title: '状态',
            dataIndex: 'user_status',
            render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v === 'active' ? '启用' : '禁用'}</Tag>,
          },
          {
            title: '操作',
            render: (_v: unknown, row) => (
              <Button
                size="small"
                danger={row.user_status === 'active'}
                onClick={() => patch(row.id, { user_status: row.user_status === 'active' ? 'disabled' : 'active' })}
              >
                {row.user_status === 'active' ? '禁用' : '启用'}
              </Button>
            ),
          },
        ]}
      />
      <Modal open={open} title="新建账号" onOk={create} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="user_name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="login_account" label="登录账号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role_type" label="角色" initialValue="member">
            <Select
              options={[
                { value: 'member', label: '成员' },
                { value: 'tenant_admin', label: '管理员' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={inviteOpen}
        title="邀请成员"
        onOk={invite}
        onCancel={() => {
          setInviteOpen(false);
          setInviteLink(null);
          inviteForm.resetFields();
        }}
      >
        <Form form={inviteForm} layout="vertical">
          <Form.Item name="login_account" label="登录账号（邮箱）" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="user_name" label="姓名（可选）">
            <Input />
          </Form.Item>
          <Form.Item name="role_type" label="角色" initialValue="member">
            <Select
              options={[
                { value: 'member', label: '成员' },
                { value: 'tenant_admin', label: '管理员' },
              ]}
            />
          </Form.Item>
          {inviteLink && (
            <Typography.Paragraph copyable style={{ color: '#1677ff', wordBreak: 'break-all' }}>
              {inviteLink}
            </Typography.Paragraph>
          )}
        </Form>
      </Modal>
    </>
  );
}
