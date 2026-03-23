// src/components/modals/EditPlayerModal.tsx
import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { PlayersApi } from "../../api/endpoints";
import { StarRating } from "./AddGuestModal";

type PlayerDto = {
    id: string;
    userId?: string | null;
    userName?: string | null;
    name: string;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
    guestStarRating?: number | null;
};

export function EditPlayerModal({
    open,
    player,
    isAdmin,
    onClose,
    onSaved,
}: {
    open: boolean;
    player: PlayerDto | null;
    isAdmin: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState("");
    const [skillPoints, setSkillPoints] = useState(0);
    const [active, setActive] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [starRating, setStarRating] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    // ESC key handler
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open && player) {
            setName(player.name);
            setSkillPoints(player.skillPoints);
            setActive(player.status === 1);
            setIsGuest(player.isGuest);
            setStarRating(player.guestStarRating ?? null);
            setLoading(false);
            setErr(null);
            setTimeout(() => nameRef.current?.focus(), 60);
        }
    }, [open, player]);

    async function handleSave() {
        if (!player) return;
        if (!name.trim()) { setErr("Nome é obrigatório."); return; }
        if (isAdmin && isGuest && starRating === null) {
            setErr("Informe o nível estimado do convidado.");
            return;
        }
        setLoading(true);
        setErr(null);
        try {
            const dto: any = { name: name.trim() };
            if (isAdmin) {
                dto.skillPoints = skillPoints;
                dto.status = active ? 1 : 2;
                dto.isGuest = isGuest;
                if (isGuest) dto.guestStarRating = starRating ?? null;
            }
            await PlayersApi.update(player.id, dto);
            onSaved();
            onClose();
        } catch (e: any) {
            setErr(
                e?.response?.data?.error ??
                e?.response?.data?.message ??
                "Erro ao salvar alterações."
            );
        } finally {
            setLoading(false);
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !loading) handleSave();
        if (e.key === "Escape") onClose();
    }

    if (!open || !player) return null;

    return (
        <div className="fixed inset-0 z-50" onKeyDown={handleKey}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border flex flex-col overflow-hidden">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                                <Pencil size={16} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900 dark:text-white">Editar jogador</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{player.name}</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            aria-label="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* body */}
                    <div className="px-5 py-5 space-y-4">
                        {/* Nome — disponível para todos */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nome</label>
                            <input
                                ref={nameRef}
                                className="input w-full"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        {/* Campos exclusivos para admin */}
                        {isAdmin && (
                            <>
                                {/* Toggle Mensalista/Convidado — só aparece para mensalistas (convidado só vira mensalista via invite) */}
                                {!player?.isGuest && <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        role="switch"
                                        aria-checked={!isGuest}
                                        onClick={() => !loading && setIsGuest((v) => !v)}
                                        className={[
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            !isGuest ? "bg-emerald-500" : "bg-slate-300",
                                            loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                        ].join(" ")}
                                    >
                                        <span
                                            className={[
                                                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                                !isGuest ? "translate-x-6" : "translate-x-1",
                                            ].join(" ")}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {isGuest ? "Convidado" : "Mensalista"}
                                    </span>
                                </label>}

                                {/* Star rating — visível quando isGuest */}
                                {isGuest && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                Nível estimado
                                                <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">(obrigatório)</span>
                                            </label>
                                            {starRating !== null && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                                    onClick={() => setStarRating(null)}
                                                    disabled={loading}
                                                >
                                                    limpar
                                                </button>
                                            )}
                                        </div>
                                        <StarRating value={starRating} onChange={setStarRating} disabled={loading} />
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            Usado pelo algoritmo de times até o convidado ter 3 partidas.
                                        </p>
                                    </div>
                                )}

                                {/* Toggle Ativo/Inativo */}
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        role="switch"
                                        aria-checked={active}
                                        onClick={() => !loading && setActive((v) => !v)}
                                        className={[
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            active ? "bg-emerald-500" : "bg-slate-300",
                                            loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                        ].join(" ")}
                                    >
                                        <span
                                            className={[
                                                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                                active ? "translate-x-6" : "translate-x-1",
                                            ].join(" ")}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {active ? "Ativo" : "Inativo"}
                                    </span>
                                </label>
                            </>
                        )}

                        {err && <p className="text-sm text-rose-500">{err}</p>}
                    </div>

                    {/* footer */}
                    <div className="px-5 pb-5 shrink-0">
                        <button
                            type="button"
                            className="btn btn-primary w-full flex items-center justify-center gap-2"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading
                                ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
                                : "Salvar"
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EditPlayerModal;
