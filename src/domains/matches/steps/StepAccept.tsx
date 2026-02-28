import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import type { PlayerInMatchDto } from "../matchTypes";
import { InviteList } from "../ui/InviteList";
import { cls } from "../matchUtils";

// ── Modal de adicionar convidado ─────────────────────────────────────────────

function AddGuestModal({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (name: string, isGoalkeeper: boolean) => Promise<void>;
}) {
    const [name, setName] = useState("");
    const [isGoalkeeper, setIsGoalkeeper] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    async function handleSubmit() {
        if (!name.trim()) { setError("Nome é obrigatório."); return; }
        setLoading(true);
        setError(null);
        try {
            await onSubmit(name.trim(), isGoalkeeper);
            setName("");
            setIsGoalkeeper(false);
            onClose();
        } catch (e: any) {
            setError(e?.response?.data?.error ?? e?.message ?? "Erro ao adicionar convidado.");
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") handleSubmit();
        if (e.key === "Escape") onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onKeyDown={handleKeyDown}>
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 shrink-0">
                        <UserPlus size={18} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold text-slate-900">Adicionar Convidado</div>
                        <div className="text-xs text-slate-500">Sem conta no sistema — será adicionado à partida</div>
                    </div>
                    <button
                        className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                        onClick={onClose}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                        <input
                            autoFocus
                            type="text"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder="Nome do convidado"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={80}
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="accent-amber-500 w-4 h-4"
                            checked={isGoalkeeper}
                            onChange={(e) => setIsGoalkeeper(e.target.checked)}
                        />
                        <span className="text-sm text-slate-700">Goleiro</span>
                    </label>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button className="btn" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button
                        className="btn bg-amber-500 hover:bg-amber-600 text-white border-transparent disabled:opacity-50"
                        onClick={handleSubmit}
                        disabled={loading || !name.trim()}
                    >
                        {loading ? "Salvando…" : "Adicionar"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── StepAccept ───────────────────────────────────────────────────────────────

export function StepAccept({
    admin,
    accepted,
    rejected,
    pending,
    mutatingInvite,
    activePlayerId,
    acceptedOverLimit,
    onAccept,
    onReject,
    onRefresh,
    onGoToMatchMaking,
    onAddGuest,
}: {
    admin: boolean;
    accepted: PlayerInMatchDto[];
    rejected: PlayerInMatchDto[];
    pending: PlayerInMatchDto[];
    mutatingInvite: Record<string, boolean>;
    activePlayerId: string | null;
    acceptedOverLimit: boolean;
    onAccept: (playerId: string) => void;
    onReject: (playerId: string) => void;
    onRefresh: () => void;
    onGoToMatchMaking: () => void;
    onAddGuest?: (name: string, isGoalkeeper: boolean) => Promise<void>;
}) {
    const [addGuestOpen, setAddGuestOpen] = useState(false);

    async function handleGuestSubmit(name: string, isGoalkeeper: boolean) {
        if (onAddGuest) await onAddGuest(name, isGoalkeeper);
        onRefresh();
    }

    return (
        <>
            <AddGuestModal
                open={addGuestOpen}
                onClose={() => setAddGuestOpen(false)}
                onSubmit={handleGuestSubmit}
            />

            <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <InviteList
                        title="Aceitos"
                        items={accepted}
                        variant="accepted"
                        isAdmin={admin}
                        activePlayerId={activePlayerId}
                        mutatingInvite={mutatingInvite}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                    <InviteList
                        title="Não Aceitos"
                        items={rejected}
                        variant="rejected"
                        isAdmin={admin}
                        activePlayerId={activePlayerId}
                        mutatingInvite={mutatingInvite}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                    <InviteList
                        title="Pendentes"
                        items={pending}
                        variant="pending"
                        isAdmin={admin}
                        activePlayerId={activePlayerId}
                        mutatingInvite={mutatingInvite}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                </div>

                <div className="card p-4">
                    {admin ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="muted text-sm">
                                <>Admin: você pode aceitar/recusar <b>qualquer jogador</b>.</>
                                <div className="muted">Regras: pendente → qualquer lista; aceito ↔ não aceito; <b>não volta para pendente</b>.</div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {onAddGuest && (
                                    <button
                                        className="btn flex items-center gap-1.5"
                                        onClick={() => setAddGuestOpen(true)}
                                        title="Adicionar convidado diretamente na partida"
                                    >
                                        <UserPlus size={14} />
                                        <span className="hidden sm:inline">Convidado</span>
                                    </button>
                                )}

                                <button className="btn" onClick={onRefresh}>Recarregar</button>

                                <button
                                    className={cls("btn btn-primary", (acceptedOverLimit || accepted.length < 2) && "opacity-50 pointer-events-none")}
                                    disabled={acceptedOverLimit || accepted.length < 2}
                                    onClick={onGoToMatchMaking}
                                    title="Avança para MatchMaking (times/cores/swap)"
                                >
                                    Ir para MatchMaking
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="muted text-sm">
                            Você só pode aceitar/recusar <b>seu próprio nome</b>. Depois, aguarde o admin avançar as etapas.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
