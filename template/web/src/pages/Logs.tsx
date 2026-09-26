import { useEffect, useState } from 'react';
import { Button, Space, Table, Tag, message } from 'antd';
import { api, errMsg } from '../api';

interface LogRow {
  id: string;
  operate_user_id: string | null;
  operate_type: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
}

export default function Logs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get('/operation-logs', { params: { page: p, page_size: 20 } });
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

  const exportCsv = async () => {
    try {
      const res = await api.get('/export/operation-logs.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'operation-logs.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={exportCsv}>导出 CSV</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => void load(p) }}
        columns={[
          { title: '操作类型', dataIndex: 'operate_type', render: (v: string) => <Tag>{v}</Tag> },
          { title: '对象', dataIndex: 'source_type', render: (v: string | null) => v ?? '-' },
          { title: '对象 ID', dataIndex: 'source_id', render: (v: string | null) => v ?? '-' },
          { title: '操作人', dataIndex: 'operate_user_id', render: (v: string | null) => v ?? '-' },
          { title: '时间', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />
    </>
  );
}
