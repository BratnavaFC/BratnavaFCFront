import axios, { AxiosError, AxiosInstance } from "axios";
import { useAccountStore } from "../auth/accountStore";

const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.trim()?.replace(/\/+$/, "");

// ✅ debug: isso aparece no console do site publicado
console.log("[CONFIG] VITE_API_URL =", baseURL);

if (!baseURL) {
    throw new Error(
        "VITE_API_URL está vazio no build publicado. Configure GitHub Actions repo variable VITE_API_URL e faça novo deploy."
    );
}

export const http: AxiosInstance = axios.create({ baseURL });

// ── Helpers de token ─────────────────────────────────────────────────────────

/** Retorna true se o JWT expirou ou vai expirar nos próximos `bufferSeconds` */
function isTokenExpiring(token: string, bufferSeconds = 60): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp: number | undefined = payload.exp; // segundos desde epoch
        return !exp || Date.now() / 1000 >= exp - bufferSeconds;
    } catch {
        return false;
    }
}

// ── Refresh (usa axios puro para não passar pelos interceptors e evitar loop) ─

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
    const store = useAccountStore.getState();
    const active = store.getActive();
    if (!active?.refreshToken) throw new Error("No refresh token");

    // ⚠️ axios direto, NÃO o http — evita loop com o request interceptor
    const res = await axios.post(
        `${baseURL}/api/Authentication/refresh-token`,
        { refreshToken: active.refreshToken }
    );

    // Backend retorna ApiResponse<TokenDto>: { success, data: { token, refreshToken } }
    // TokenDto usa propriedade "token", não "accessToken"
    const data = (res.data as any)?.data;
    const accessToken = data?.token ?? data?.accessToken ?? data?.jwt;
    const refreshToken = data?.refreshToken ?? data?.refresh ?? active.refreshToken;

    if (!accessToken) throw new Error("Refresh did not return accessToken");

    store.updateActive({ accessToken, refreshToken });
}

/** Garante que o token está válido antes de prosseguir com o request */
async function ensureFreshToken(): Promise<void> {
    const active = useAccountStore.getState().getActive();
    if (!active?.accessToken || !isTokenExpiring(active.accessToken)) return;

    if (!refreshPromise) refreshPromise = doRefresh().finally(() => (refreshPromise = null));
    await refreshPromise;
}

// ── Request interceptor: verifica expiração antes de cada chamada ─────────────

http.interceptors.request.use(async (config) => {
    try {
        await ensureFreshToken();
    } catch {
        // Se o refresh proativo falhou, prossegue — o interceptor de resposta
        // vai capturar o 401 e tentar de novo (ou fazer logout se inválido)
    }
    const active = useAccountStore.getState().getActive();
    if (active?.accessToken) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${active.accessToken}`;
    }
    return config;
});

// ── Response interceptor: refresh reativo no 401 (segunda linha de defesa) ───

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
                useAccountStore.getState().logout();
            }
        }
        throw err;
    }
);
