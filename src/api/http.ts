import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAccountStore } from '../auth/accountStore';
import type { RefreshTokenDto } from './generated/types';

const baseURL = import.meta.env.VITE_API_URL;

export const http: AxiosInstance = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const active = useAccountStore.getState().getActive();
  if (active?.accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${active.accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const store = useAccountStore.getState();
  const active = store.getActive();
  if (!active?.refreshToken) throw new Error('No refresh token');
  const payload: RefreshTokenDto = { refreshToken: active.refreshToken } as any;

  const res = await axios.post(`${baseURL}/api/Authentication/refresh-token`, payload, {
    headers: active.accessToken ? { Authorization: `Bearer ${active.accessToken}` } : undefined
  });

  const accessToken = res.data?.accessToken ?? res.data?.token ?? res.data?.jwt;
  const refreshToken = res.data?.refreshToken ?? res.data?.refresh ?? active.refreshToken;

  if (!accessToken) throw new Error('Refresh did not return accessToken');

  store.updateActive({ accessToken, refreshToken });
}

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as any;

    if (status === 401 && !original?._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) refreshPromise = doRefresh().finally(() => (refreshPromise = null));
        await refreshPromise;
        return http(original);
      } catch (e) {
        const active = useAccountStore.getState().getActive();
        //if (active?.userId) useAccountStore.getState().logout(active.userId);
      }
    }
    throw err;
  }
);
