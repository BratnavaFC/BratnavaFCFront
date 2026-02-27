import type { PlayerInMatchDto } from "../matchTypes";
import { cls, canUserActOnPlayer } from "../matchUtils";

export function InviteList({
    title,
    items,
    variant,
    isAdmin,
    activePlayerId,
    mutatingInvite,
    onAccept,
    onReject,
}: {
    title: string;
    items: PlayerInMatchDto[];
    variant: "accepted" | "rejected" | "pending";
    isAdmin: boolean;
    activePlayerId: string | null;
    mutatingInvite: Record<string, boolean>;
    onAccept: (playerId: string) => void;
    onReject: (playerId: string) => void;
}) {
    return (
        <div className="card p-4">
            <div className="flex items-center justify-between">
                <div className="font-semibold">{title}</div>
                <span className="pill">{items.length}</span>
            </div>

            <div className="mt-3 grid gap-2">
                {items.map((p) => {
                    const pid = p.playerId;
                    const name = p.playerName || "—";
                    const canAct = canUserActOnPlayer(isAdmin, activePlayerId, pid);
                    const busy = !!mutatingInvite[pid];

                    const showAccept = canAct && (variant === "pending" || variant === "rejected");
                    const showReject = canAct && (variant === "pending" || variant === "accepted");

                    return (
                        <div
                            key={pid}
                            className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2 bg-white"
                        >
                            <div className="min-w-0">
                                <div className="font-medium truncate">
                                    {name} {p.isGoalkeeper ? <span title="Goleiro">🧤</span> : null}
                                </div>
                                <div className="text-xs text-slate-500 truncate">{pid}</div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {showReject ? (
                                    <button
                                        className={cls("btn", busy && "opacity-50 pointer-events-none")}
                                        title="Recusar"
                                        disabled={busy}
                                        onClick={() => onReject(pid)}
                                    >
                                        ✕
                                    </button>
                                ) : null}

                                {showAccept ? (
                                    <button
                                        className={cls("btn btn-primary", busy && "opacity-50 pointer-events-none")}
                                        title="Aceitar"
                                        disabled={busy}
                                        onClick={() => onAccept(pid)}
                                    >
                                        ✓
                                    </button>
                                ) : null}

                                {!canAct ? <span className="pill">—</span> : null}
                            </div>
                        </div>
                    );
                })}

                {items.length === 0 ? <div className="muted">Nenhum.</div> : null}
            </div>
        </div>
    );
}