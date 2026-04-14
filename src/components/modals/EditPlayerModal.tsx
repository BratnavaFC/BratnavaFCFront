// src/components/modals/EditPlayerModal.tsx
import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, X, Swords, Shield, Star } from "lucide-react";
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
    attackRating?: number | null;
    defenseRating?: number | null;
    overallRating?: number | null;
};

// ── Rating slider 0-10 ────────────────────────────────────────────────────────

function RatingSlider({
    label,
    icon,
    value,
    onChange,
    disabled,
    color,
    description,
}: {
    label: string;
    icon: React.ReactNode;
    value: number | null;
    onChange: (v: number | null) => void;
    disabled?: boolean;
    color: string;
    description: string;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {icon}
                    {label}
                </div>
                <div className="flex items-center gap-2">
                    {value !== null ? (
                        <>
                            <span className="text-lg font-bold tabular-nums" style={{ color }}>
                                {value}
                            </span>
                            <span className="text-xs text-slate-400">/10</span>
                            <button
                                type="button"
                                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                                onClick={() => onChange(null)}
                                disabled={disabled}
                            >
                                limpar
                            </button>
                        </>
                    ) : (
                        <span className="text-xs text-slate-400 italic">não avaliado</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Quick-set buttons for 0 and 10 */}
                <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-600 w-4 shrink-0"
                    onClick={() => onChange(0)}
                    disabled={disabled}
                >0</button>

                <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={value ?? 5}
                    disabled={disabled}
                    onChange={e => onChange(Number(e.target.value))}
                    onMouseDown={() => { if (value === null) onChange(5); }}
                    onTouchStart={() => { if (value === null) onChange(5); }}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-current disabled:opacity-40"
                    style={{ accentColor: color }}
                />

                <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-600 w-4 shrink-0 text-right"
                    onClick={() => onChange(10)}
                    disabled={disabled}
                >10</button>
            </div>

            {/* Tick marks */}
            <div className="flex justify-between px-5 text-[10px] text-slate-300 dark:text-slate-600 select-none">
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <span key={n}>{n}</span>
                ))}
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>
        </div>
    );
}

// ── EditPlayerModal ───────────────────────────────────────────────────────────

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
    const [name,          setName]          = useState("");
    const [skillPoints,   setSkillPoints]   = useState(0);
    const [active,        setActive]        = useState(true);
    const [isGuest,       setIsGuest]       = useState(false);
    const [starRating,    setStarRating]    = useState<number | null>(null);
    const [attackRating,  setAttackRating]  = useState<number | null>(null);
    const [defenseRating, setDefenseRating] = useState<number | null>(null);
    const [overallRating, setOverallRating] = useState<number | null>(null);
    const [loading,       setLoading]       = useState(false);
    const [err,           setErr]           = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);

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
            setAttackRating(player.attackRating ?? null);
            setDefenseRating(player.defenseRating ?? null);
            setOverallRating(player.overallRating ?? null);
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
                dto.skillPoints    = skillPoints;
                dto.status         = active ? 1 : 2;
                dto.isGuest        = isGuest;
                dto.attackRating   = attackRating;
                dto.defenseRating  = defenseRating;
                dto.overallRating  = overallRating;
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

    const hasAnyRating = attackRating !== null || defenseRating !== null || overallRating !== null;

    return (
        <div className="fixed inset-0 z-50" onKeyDown={handleKey}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border flex flex-col overflow-hidden max-h-[90vh]">

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
                    <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1">

                        {/* Nome */}
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

                        {/* Admin-only fields */}
                        {isAdmin && (
                            <>
                                {/* Toggle Mensalista/Convidado */}
                                {!player?.isGuest && (
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <div
                                            role="switch"
                                            aria-checked={!isGuest}
                                            onClick={() => !loading && setIsGuest(v => !v)}
                                            className={[
                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                                !isGuest ? "bg-emerald-500" : "bg-slate-300",
                                                loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                            ].join(" ")}
                                        >
                                            <span className={["inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", !isGuest ? "translate-x-6" : "translate-x-1"].join(" ")} />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {isGuest ? "Convidado" : "Mensalista"}
                                        </span>
                                    </label>
                                )}

                                {/* Star rating — só para convidados */}
                                {isGuest && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                Nível estimado
                                                <span className="ml-1 text-xs font-normal text-slate-400">(obrigatório)</span>
                                            </label>
                                            {starRating !== null && (
                                                <button type="button" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onClick={() => setStarRating(null)} disabled={loading}>
                                                    limpar
                                                </button>
                                            )}
                                        </div>
                                        <StarRating value={starRating} onChange={setStarRating} disabled={loading} />
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            Usado pelo algoritmo até o convidado ter 3 partidas.
                                        </p>
                                    </div>
                                )}

                                {/* ── Ratings 0-10 ─────────────────────────────────── */}
                                <div className="pt-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            Avaliação do jogador
                                        </div>
                                        {hasAnyRating && (
                                            <button
                                                type="button"
                                                className="text-xs text-slate-400 hover:text-slate-600 underline"
                                                onClick={() => { setAttackRating(null); setDefenseRating(null); setOverallRating(null); }}
                                                disabled={loading}
                                            >
                                                limpar tudo
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                                        <RatingSlider
                                            label="Geral"
                                            icon={<Star size={14} className="text-amber-500" />}
                                            value={overallRating}
                                            onChange={setOverallRating}
                                            disabled={loading}
                                            color="#f59e0b"
                                            description="Avaliação geral do jogador. Tem peso 50% no algoritmo."
                                        />
                                        <RatingSlider
                                            label="Ataque"
                                            icon={<Swords size={14} className="text-rose-500" />}
                                            value={attackRating}
                                            onChange={setAttackRating}
                                            disabled={loading}
                                            color="#f43f5e"
                                            description="Finalização, drible, posicionamento ofensivo."
                                        />
                                        <RatingSlider
                                            label="Defesa"
                                            icon={<Shield size={14} className="text-blue-500" />}
                                            value={defenseRating}
                                            onChange={setDefenseRating}
                                            disabled={loading}
                                            color="#3b82f6"
                                            description="Marcação, interceptação, posicionamento defensivo."
                                        />
                                    </div>

                                    {hasAnyRating && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                            Quando avaliações são definidas, o algoritmo usa:{" "}
                                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                                40% histórico + 20% gols + 40% avaliação
                                            </span>
                                        </p>
                                    )}
                                </div>

                                {/* Toggle Ativo/Inativo */}
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        role="switch"
                                        aria-checked={active}
                                        onClick={() => !loading && setActive(v => !v)}
                                        className={[
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            active ? "bg-emerald-500" : "bg-slate-300",
                                            loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                        ].join(" ")}
                                    >
                                        <span className={["inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", active ? "translate-x-6" : "translate-x-1"].join(" ")} />
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
