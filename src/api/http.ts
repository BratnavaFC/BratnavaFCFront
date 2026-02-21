import axios, { AxiosError, AxiosInstance } from "axios";
import { useAccountStore } from "../auth/accountStore";
import type { RefreshTokenDto } from "./generated/types";

// ✅ Normaliza e valida env (evita cair no GitHub Pages sem perceber)
const rawBaseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const baseURL = rawBaseURL.trim().replace(/\/+$/, ""); // remove trailing /

function assertBaseUrl() {
    if (!baseURL) {
        // Mensagem bem direta pra debug em prod
        throw new Error(
            "VITE_API_URL não definido no build. Configure GitHub Actions vars.VITE_API_URL com https://bratnavafcapi.fly.dev"
        );
    }
}

assertBaseUrl();

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

    // ✅ Use o mesmo client (baseURL garantido) e caminho relativo
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
                if (!refreshPromise) {
                    refreshPromise = doRefresh().finally(() => (refreshPromise = null));
                }
                await refreshPromise;

                // ✅ reexecuta a request original já com token atualizado
                return http(original);
            } catch {
                // ✅ seu store não tem logout(userId). Use logout() (que chama logoutActive())
                useAccountStore.getState().logout();
            }
        }

        throw err;
    }
);