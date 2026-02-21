import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../components/Field";
import { AuthApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import type { LoginDto } from "../api/generated/types";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(3),
});

type Form = z.infer<typeof schema>;

/** JWT helpers (mantidos aqui pra ficar “login completo” mesmo) */
function parseJwt(token: string): any | null {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

function getUserIdFromJwt(token: string): string | null {
    const p = parseJwt(token);
    return p?.sub ?? null;
}

/**
 * ✅ Lê role do JWT em:
 * - "role" (recomendado)
 * - ClaimTypes.Role (chave MS)
 */
function getRoleFromJwt(token: string): string | null {
    const p = parseJwt(token);
    if (!p) return null;

    if (typeof p.role === "string" && p.role.trim()) return p.role;

    const msKey = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
    const ms = p[msKey];
    if (typeof ms === "string" && ms.trim()) return ms;

    return null;
}

export default function LoginPage() {
    const nav = useNavigate();
    const [sp] = useSearchParams();
    const addMode = sp.get("add") === "1";

    const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
        defaultValues: { email: "", password: "" },
    });

    const upsertAccount = useAccountStore((s) => s.upsertAccount);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
    }, [addMode]);

    const onSubmit = async (form: Form) => {
        setError(null);

        const dto: LoginDto = { username: form.email, password: form.password } as any;

        const res = await AuthApi.login(dto);

        const accessToken =
            res.data?.accessToken ??
            res.data?.token ??
            res.data?.jwt;

        const refreshToken =
            res.data?.refreshToken ??
            res.data?.refresh;

        const user = res.data?.user ?? res.data;

        if (!accessToken || !refreshToken) {
            setError("Login não retornou accessToken/refreshToken. Ajuste o mapeamento no LoginPage.tsx");
            return;
        }

        // userId: tenta do response e fallback para JWT.sub
        const userIdFromJwt = getUserIdFromJwt(accessToken);

        const userId =
            user?.id ??
            user?.userId ??
            userIdFromJwt;

        if (!userId) {
            setError("Não consegui obter o UserId do backend/JWT. Ajuste os claims do token ou o retorno do login.");
            return;
        }

        // roles: pega do JWT (preferido), se não tiver tenta do response
        const roleFromJwt = getRoleFromJwt(accessToken);

        const roles: string[] =
            roleFromJwt
                ? [roleFromJwt]
                : Array.isArray(user?.roles)
                    ? user.roles
                    : [];

        upsertAccount({
            userId,
            name: user?.name ?? user?.userName ?? form.email,
            email: user?.email ?? form.email,
            roles, // ✅ string[]
            accessToken,
            refreshToken,
        });

        nav("/app");
    };

    return (
        <div className="min-h-screen grid place-items-center p-6">
            <div className="card w-full max-w-md p-6">
                <div className="text-2xl font-black tracking-tight">
                    {addMode ? "Adicionar conta" : "Entrar"}
                </div>

                <div className="muted mt-1">
                    Login via /api/Authentication/login + refresh automático.
                </div>

                <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <Field label="Email">
                        <input
                            className="input"
                            placeholder="voce@email.com"
                            {...register("email")}
                        />
                    </Field>

                    <Field label="Senha">
                        <input
                            className="input"
                            type="password"
                            placeholder="••••••••"
                            {...register("password")}
                        />
                    </Field>

                    {error ? <div className="text-sm text-rose-600">{error}</div> : null}

                    <button className="btn btn-primary w-full" disabled={isSubmitting}>
                        {isSubmitting ? "Entrando..." : "Entrar"}
                    </button>

                    <div className="text-sm text-slate-600">
                        Não tem usuário?{" "}
                        <Link className="underline" to="/register">
                            Criar usuário
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}