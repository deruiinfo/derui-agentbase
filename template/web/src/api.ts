import axios from 'axios';

export const TOKEN_KEY = 'admin_token';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export function errMsg(e: unknown): string {
  const msg = (e as { response?: { data?: { msg?: string } } })?.response?.data?.msg;
  return msg ?? '请求失败';
}

export interface User {
  id: string;
  user_name: string;
  login_account: string;
  role_type: 'tenant_admin' | 'member';
  user_status?: string;
  two_factor_enabled?: boolean;
}

export interface Me {
  user_id: string;
  tenant_id: string;
  role_type: string;
  user: User;
}

export async function fetchMe(): Promise<Me> {
  const res = await api.get('/me');
  return res.data.data as Me;
}
