import axios, { AxiosError, AxiosInstance } from "axios";
import { useAccountStore } from "../auth/accountStore";
import type { RefreshTokenDto } from "./generated/types";

const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.trim()?.replace(/\/+$/, "");

// ✅ debug: isso aparece no console do site publicado
console.log("[CONFIG] VITE_API_URL =", baseURL);

if (!baseURL) {
    throw new Error(
        "VITE_API_URL está vazio no build publicado. Configure GitHub Actions repo variable VITE_API_URL e faça novo deploy."
    );
}

export const http: AxiosInstance = axios.create({ baseURL });

http.interceptors.request.use((config) => {
    const active = useAccountStore.getState().getActive();
    if (active?.accessToken) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${active.accessToken}`;
    }
    return config;
});

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
    const store = useAccountStore.getState();
    const active = store.getActive();
    if (!active?.refreshToken) throw new Error("No refresh token");

    const payload: RefreshTokenDto = { refreshToken: active.refreshToken } as any;

    const res = await http.post("/api/Authentication/refresh-token", payload, {
        headers: active.accessToken
            ? { Authorization: `Bearer ${active.accessToken}` }
            : undefined,
    });

    const accessToken = (res.data as any)?.accessToken ?? (res.data as any)?.token ?? (res.data as any)?.jwt;
    const refreshToken = (res.data as any)?.refreshToken ?? (res.data as any)?.refresh ?? active.refreshToken;

    if (!accessToken) throw new Error("Refresh did not return accessToken");

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
            } catch {
                useAccountStore.getState().logout(); // ✅ no seu store existe logout()
            }
        }
        throw err;
    }
);