import type { PlayerInMatchDto } from "../matchTypes";
import { InviteList } from "../ui/InviteList";
import { cls } from "../matchUtils";

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
}) {
    return (
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

                        <div className="flex items-center gap-2">
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
    );
}