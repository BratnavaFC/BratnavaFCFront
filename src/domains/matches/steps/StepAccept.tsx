import { RefreshCw } from "lucide-react";
import type { PlayerInMatchDto } from "../matchTypes";
import { InviteList } from "../ui/InviteList";
import { cls } from "../matchUtils";

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
    onSetPlayerRole?: (matchPlayerId: string, isGoalkeeper: boolean) => Promise<void>;
}) {
    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={onRefresh}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50"
                >
                    <RefreshCw size={12} />
                    Recarregar
                </button>
            </div>

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

            {admin && (
                <div className="card p-4 flex justify-end">
                    <button
                        className={cls("btn btn-primary", (acceptedOverLimit || accepted.length < 2) && "opacity-50 pointer-events-none")}
                        disabled={acceptedOverLimit || accepted.length < 2}
                        onClick={onGoToMatchMaking}
                        title="Avança para MatchMaking (times/cores/swap)"
                    >
                        Ir para MatchMaking
                    </button>
                </div>
            )}
        </div>
    );
}
