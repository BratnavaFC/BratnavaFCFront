import { useState } from "react";
import { UserPlus } from "lucide-react";
import type { PlayerInMatchDto } from "../matchTypes";
import { InviteList } from "../ui/InviteList";
import { cls } from "../matchUtils";
import { AddGuestModal } from "../../../components/AddGuestModal";

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
    onSetPlayerRole,
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
    onAddGuest?: (name: string, isGoalkeeper: boolean, starRating: number | null) => Promise<void>;
    onSetPlayerRole?: (matchPlayerId: string, isGoalkeeper: boolean) => Promise<void>;
}) {
    const [addGuestOpen, setAddGuestOpen] = useState(false);

    async function handleGuestSubmit(name: string, isGoalkeeper: boolean, starRating: number | null) {
        if (onAddGuest) await onAddGuest(name, isGoalkeeper, starRating);
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
                        onSetPlayerRole={onSetPlayerRole}
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
                        onSetPlayerRole={onSetPlayerRole}
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
                        onSetPlayerRole={onSetPlayerRole}
                    />
                </div>

                <div className="card p-4">
                    {admin ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
