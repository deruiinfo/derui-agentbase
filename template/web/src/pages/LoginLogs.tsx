import { useEffect, useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, message } from 'antd';
import { api, errMsg } from '../api';

interface Row {
  id: string;
  login_account: string | null;
  result: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const RESULT_COLOR: Record<string, string> = {
  success: 'green',
  fail: 'red',
  locked: 'orange',
  disabled: 'default',
};

export default function LoginLogs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<string | undefined>();
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/login-logs', {
        params: { page: p, page_size: 20, result, account: account || undefined },
      });
      setRows(res.data.data.list);
      setTotal(res.data.data.total);
      setPage(p);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, []);

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="结果"
          style={{ width: 120 }}
          value={result}
          onChange={setResult}
          options={[
            { value: 'success', label: '成功' },
            { value: 'fail', label: '失败' },
            { value: 'locked', label: '锁定' },
            { value: 'disabled', label: '禁用/未激活' },
          ]}
        />
        <Input.Search placeholder="账号" allowClear style={{ width: 200 }} onSearch={setAccount} />
        <Button type="primary" onClick={() => void load(1)}>
          查询
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => void load(p) }}
        columns={[
          { title: '账号', dataIndex: 'login_account', render: (v: string | null) => v ?? '-' },
          {
            title: '结果',
            dataIndex: 'result',
            render: (v: string) => <Tag color={RESULT_COLOR[v] ?? 'default'}>{v}</Tag>,
          },
          { title: 'IP', dataIndex: 'ip_address', render: (v: string | null) => v ?? '-' },
          { title: 'UA', dataIndex: 'user_agent', ellipsis: true, render: (v: string | null) => v ?? '-' },
          { title: '时间', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />
    </>
  );
}
