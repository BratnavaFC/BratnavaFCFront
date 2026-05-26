import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Field } from "../components/Field";
import { AuthApi } from "../api/endpoints";
import { useNavigate, Link } from "react-router-dom";
import { getResponseMessage } from "../api/apiResponse";

const emailSchema = z.object({ email: z.string().email() });
const codeSchema = z.object({ code: z.string().length(6) });
const passwordSchema = z.object({
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
});

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ForgotPasswordPage() {
    const nav = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");

    const emailForm = useForm<EmailForm>({ defaultValues: { email: "" } });
    const codeForm = useForm<CodeForm>({ defaultValues: { code: "" } });
    const passwordForm = useForm<PasswordForm>({ defaultValues: { newPassword: "", confirmPassword: "" } });

    const onSubmitEmail = async (form: EmailForm) => {
        try {
            await AuthApi.forgotPassword({ email: form.email });
            setEmail(form.email);
            setStep(2);
            toast.success("Código enviado! Verifique seu email.");
        } catch (e) {
            toast.error(getResponseMessage(e, "Erro ao enviar o código."));
        }
    };

    const onSubmitCode = (form: CodeForm) => {
        setCode(form.code);
        setStep(3);
    };

    const onSubmitPassword = async (form: PasswordForm) => {
        if (form.newPassword !== form.confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }
        try {
            await AuthApi.resetPassword({ email, code, newPassword: form.newPassword });
            toast.success("Senha redefinida com sucesso!");
            setTimeout(() => nav("/login"), 1000);
        } catch (e) {
            toast.error(getResponseMessage(e, "Código inválido ou expirado."));
        }
    };

    return (
        <div className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
            <div className="card w-full max-w-md p-6">
                <div className="text-2xl font-black tracking-tight">Recuperar senha</div>

                {step === 1 && (
                    <form className="mt-6 space-y-4" onSubmit={emailForm.handleSubmit(onSubmitEmail)}>
                        <Field label="Email">
                            <input
                                className="input"
                                placeholder="voce@email.com"
                                {...emailForm.register("email")}
                            />
                        </Field>
                        <button
                            className="btn btn-primary w-full"
                            disabled={emailForm.formState.isSubmitting}
                        >
                            {emailForm.formState.isSubmitting ? "Enviando..." : "Enviar código"}
                        </button>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <Link className="underline" to="/login">Voltar ao login</Link>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <form className="mt-6 space-y-4" onSubmit={codeForm.handleSubmit(onSubmitCode)}>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Código enviado para <strong>{email}</strong>
                        </p>
                        <Field label="Código (6 dígitos)">
                            <input
                                className="input"
                                placeholder="123456"
                                maxLength={6}
                                {...codeForm.register("code")}
                            />
                        </Field>
                        <button className="btn btn-primary w-full" type="submit">
                            Verificar
                        </button>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <button
                                type="button"
                                className="underline"
                                onClick={() => setStep(1)}
                            >
                                Reenviar código
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form className="mt-6 space-y-4" onSubmit={passwordForm.handleSubmit(onSubmitPassword)}>
                        <Field label="Nova senha">
                            <input
                                className="input"
                                type="password"
                                placeholder="••••••••"
                                {...passwordForm.register("newPassword")}
                            />
                        </Field>
                        <Field label="Confirmar nova senha">
                            <input
                                className="input"
                                type="password"
                                placeholder="••••••••"
                                {...passwordForm.register("confirmPassword")}
                            />
                        </Field>
                        <button
                            className="btn btn-primary w-full"
                            disabled={passwordForm.formState.isSubmitting}
                        >
                            {passwordForm.formState.isSubmitting ? "Redefinindo..." : "Redefinir senha"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
