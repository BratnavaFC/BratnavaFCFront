/**
 * Extrai uma mensagem de erro legível de um valor desconhecido lançado.
 * Suporta formatos de erro do Axios, objetos Error e strings brutas.
 */
export function extractApiError(e: unknown, fallback = "Ocorreu um erro inesperado."): string {
    const err = e as any;
    const data = err?.response?.data;

    // 1) { message: string } or { error: string } (Result.Fail uses "error" field)
    const msg = data?.message ?? data?.error;
    if (typeof msg === "string" && msg.trim()) return msg;

    // 2) ASP.NET ModelState: { errors: { campo: ["msg1", ...] } }
    const errors = data?.errors;
    if (errors && typeof errors === "object") {
        const firstKey = Object.keys(errors)[0];
        const firstArr = errors[firstKey];
        if (Array.isArray(firstArr) && typeof firstArr[0] === "string") return firstArr[0];
    }

    // 3) String bruta no corpo (trunca HTML/stacktraces)
    if (typeof data === "string" && data.trim()) {
        const line = data.split("\n").map((s: string) => s.trim()).find((s: string) => s.length > 0);
        return (line ?? data).slice(0, 180);
    }

    // 4) Error.message do Axios/genérico
    if (typeof err?.message === "string" && err.message.trim()) return err.message;

    return fallback;
}
