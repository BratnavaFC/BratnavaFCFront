// src/components/modals/AddGuestModal.tsx
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useAccountStore } from "../../auth/accountStore";
import { useGroupIcons } from "../../hooks/useGroupIcons";
import { IconRenderer } from "../IconRenderer";
import { resolveIcon } from "../../lib/groupIcons";

// ─── StarRating ───────────────────────────────────────────────────────────────

export function StarRating({
    value,
    onChange,
    disabled,
}: {
    value: number | null;
    onChange: (v: number | null) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(value === star ? null : star)}
                    className={[
                        "text-2xl leading-none transition-colors focus:outline-none",
                        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        star <= (value ?? 0) ? "text-amber-400" : "text-slate-300 hover:text-amber-300",
                    ].join(" ")}
                    aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

// ─── AddGuestModal ────────────────────────────────────────────────────────────

export function AddGuestModal({
    open,
    onClose,
    onSubmit,
    submitLabel = "Adicionar",
}: {
    open: boolean;
    onClose: () => void;
    /** Called with the guest's data. Should throw on API error. */
    onSubmit: (name: string, isGoalkeeper: boolean, starRating: number | null) => Promise<void>;
    submitLabel?: string;
}) {
    const [name, setName]                 = useState("");
    const [isGoalkeeper, setIsGoalkeeper] = useState(false);
    const [starRating, setStarRating]     = useState<number | null>(null);
    const [loading, setLoading]           = useState(false);
    const [err, setErr]                   = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons   = useGroupIcons(_groupId);

    // ESC key handler
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open) {
            setName("");
            setIsGoalkeeper(false);
            setStarRating(null);
            setLoading(false);
            setErr(null);
            setTimeout(() => nameRef.current?.focus(), 60);
        }
    }, [open]);

    async function handleSubmit() {
        if (!name.trim()) { setErr("Nome é obrigatório."); return; }
        setLoading(true);
        setErr(null);
        try {
            await onSubmit(name.trim(), isGoalkeeper, starRating);
            onClose();
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ??
                e?.response?.data?.message ??
                e?.message ??
                "Erro ao adicionar convidado.";
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !loading) handleSubmit();
        if (e.key === "Escape") onClose();
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50" onKeyDown={handleKey}>
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border flex flex-col overflow-hidden">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                <Plus size={17} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Adicionar convidado</div>
                                <div className="text-xs text-slate-500">Sem conta no sistema</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                            aria-label="Fechar"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* body */}
                    <div className="px-5 py-5 space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Nome do convidado</label>
                            <input
                                ref={nameRef}
                                className="input w-full"
                                placeholder="Ex: Zé da Pelada"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={isGoalkeeper}
                                onChange={(e) => setIsGoalkeeper(e.target.checked)}
                                disabled={loading}
                                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                            />
                            <span className="text-sm font-medium text-slate-700 inline-flex items-center gap-1">Goleiro <IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={14} /></span>
                        </label>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">
                                    Nível estimado
                                    <span className="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
                                </label>
                                {starRating !== null && (
                                    <button
                                        type="button"
                                        className="text-xs text-slate-400 hover:text-slate-600"
                                        onClick={() => setStarRating(null)}
                                        disabled={loading}
                                    >
                                        limpar
                                    </button>
                                )}
                            </div>
                            <StarRating value={starRating} onChange={setStarRating} disabled={loading} />
                            <p className="text-xs text-slate-400">
                                Usado pelo algoritmo de times até o convidado ter 3 partidas.
                            </p>
                        </div>

                        {err && <p className="text-sm text-rose-500">{err}</p>}
                    </div>

                    {/* footer */}
                    <div className="px-5 pb-5 shrink-0">
                        <button
                            type="button"
                            className="btn btn-primary w-full flex items-center justify-center gap-2"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading
                                ? <><Loader2 size={15} className="animate-spin" /> Adicionando...</>
                                : submitLabel
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
