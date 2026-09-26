import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Space, Table, Tag, message } from 'antd';
import { api, errMsg, type Me } from '../api';

interface DemoItem {
  id: string;
  title: string;
  status: 'draft' | 'published';
  owner_id: string | null;
  version: number;
  created_at: string;
}

export default function DemoItems({ me }: { me: Me }) {
  const [rows, setRows] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const isAdmin = me.role_type === 'tenant_admin';

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/demo-items');
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
      await api.post('/demo-items', values);
      message.success('已创建');
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const publish = async (row: DemoItem) => {
    try {
      await api.patch(`/demo-items/${row.id}`, { status: 'published' });
      message.success('已发布');
      void load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <>
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="本页演示三层权限：成员只能看到/修改自己名下的记录（RLS 行级）；越权修改会返回 404。"
      />
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          新建
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '标题', dataIndex: 'title' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => <Tag color={v === 'published' ? 'green' : 'default'}>{v}</Tag>,
          },
          {
            title: '归属',
            dataIndex: 'owner_id',
            render: (v: string | null) => (v === me.user_id ? '我' : isAdmin ? v ?? '-' : '—'),
          },
          {
            title: '操作',
            render: (_v: unknown, row: DemoItem) =>
              row.status === 'draft' ? (
                <Button size="small" type="link" onClick={() => publish(row)}>
                  发布
                </Button>
              ) : null,
          },
        ]}
      />
      <Modal open={open} title="新建演示项" onOk={create} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
