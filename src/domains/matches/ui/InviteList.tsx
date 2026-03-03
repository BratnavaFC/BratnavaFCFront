import { useMemo } from "react";
import { Check, X } from "lucide-react";
import type { PlayerInMatchDto } from "../matchTypes";
import { cls, canUserActOnPlayer } from "../matchUtils";

const VARIANT_META = {
    accepted: {
        leftBorder: "border-l-4 border-l-emerald-400",
        headerBg: "bg-emerald-50 border-emerald-100",
        countClass: "bg-emerald-100 text-emerald-700",
        titleClass: "text-emerald-700",
    },
    rejected: {
        leftBorder: "border-l-4 border-l-red-300",
        headerBg: "bg-red-50 border-red-100",
        countClass: "bg-red-100 text-red-700",
        titleClass: "text-red-700",
    },
    pending: {
        leftBorder: "border-l-4 border-l-slate-300",
        headerBg: "bg-slate-50 border-slate-200",
        countClass: "bg-slate-100 text-slate-600",
        titleClass: "text-slate-700",
    },
} as const;

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
    const vm = VARIANT_META[variant];

    // Logged-in user always appears first
    const sortedItems = useMemo(() => {
        if (!activePlayerId) return items;
        return [...items].sort((a, b) => {
            if (a.playerId === activePlayerId) return -1;
            if (b.playerId === activePlayerId) return 1;
            return 0;
        });
    }, [items, activePlayerId]);

    return (
        <div className="card overflow-hidden p-0">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${vm.headerBg}`}>
                <span className={`font-semibold text-sm ${vm.titleClass}`}>{title}</span>
                <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${vm.countClass}`}
                >
                    {items.length}
                </span>
            </div>

            <div className="p-3 grid gap-1.5">
                {sortedItems.map((p) => {
                    const pid = p.playerId;
                    const name = p.playerName || "—";
                    const isMe = pid === activePlayerId;
                    const canAct = canUserActOnPlayer(isAdmin, activePlayerId, pid);
                    const busy = !!mutatingInvite[pid];

                    const showAccept = canAct && (variant === "pending" || variant === "rejected");
                    const showReject = canAct && (variant === "pending" || variant === "accepted");

                    return (
                        <div
                            key={pid}
                            className={cls(
                                "flex items-center justify-between gap-3 border rounded-xl px-3 py-2 bg-white",
                                vm.leftBorder
                            )}
                        >
                            <div className="min-w-0 flex items-center gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-medium text-slate-900 truncate">
                                            {name}
                                        </span>
                                        {p.isGoalkeeper && (
                                            <span title="Goleiro" className="text-base leading-none">
                                                🧤
                                            </span>
                                        )}
                                        {isMe && (
                                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                                Você
                                            </span>
                                        )}
                                        {p.isGuest && (
                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                                Convidado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {showReject && (
                                    <button
                                        className={cls(
                                            "flex items-center justify-center w-7 h-7 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors",
                                            busy && "opacity-50 pointer-events-none"
                                        )}
                                        title="Recusar"
                                        disabled={busy}
                                        onClick={() => onReject(pid)}
                                    >
                                        <X size={14} />
                                    </button>
                                )}

                                {showAccept && (
                                    <button
                                        className={cls(
                                            "flex items-center justify-center w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors",
                                            busy && "opacity-50 pointer-events-none"
                                        )}
                                        title="Aceitar"
                                        disabled={busy}
                                        onClick={() => onAccept(pid)}
                                    >
                                        <Check size={14} />
                                    </button>
                                )}

                                {!canAct && !showAccept && !showReject && (
                                    <span className="text-xs text-slate-300">—</span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {sortedItems.length === 0 && (
                    <div className="py-4 text-center text-sm text-slate-400">Nenhum.</div>
                )}
            </div>
        </div>
    );
}
