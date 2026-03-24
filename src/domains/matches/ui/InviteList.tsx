import { useMemo } from "react";
import { Check, X, Users } from "lucide-react";
import type { PlayerInMatchDto } from "../matchTypes";
import { cls, canUserActOnPlayer } from "../matchUtils";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT_META = {
    accepted: {
        accent:       "border-t-2 border-t-emerald-400",
        headerColor:  "text-emerald-700 dark:text-emerald-400",
        countBg:      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
        avatarBg:     "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
        dot:          "bg-emerald-400",
    },
    rejected: {
        accent:       "border-t-2 border-t-red-400",
        headerColor:  "text-red-600 dark:text-red-400",
        countBg:      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
        avatarBg:     "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300",
        dot:          "bg-red-400",
    },
    pending: {
        accent:       "border-t-2 border-t-slate-300 dark:border-t-slate-600",
        headerColor:  "text-slate-600 dark:text-slate-400",
        countBg:      "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
        avatarBg:     "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300",
        dot:          "bg-slate-400",
    },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── InviteList ────────────────────────────────────────────────────────────────

export function InviteList({
    title,
    items,
    variant,
    isAdmin,
    activePlayerId,
    mutatingInvite,
    onAccept,
    onReject,
    onSetPlayerRole,
}: {
    title: string;
    items: PlayerInMatchDto[];
    variant: "accepted" | "rejected" | "pending";
    isAdmin: boolean;
    activePlayerId: string | null;
    mutatingInvite: Record<string, boolean>;
    onAccept: (playerId: string) => void;
    onReject: (playerId: string) => void;
    onSetPlayerRole?: (matchPlayerId: string, isGoalkeeper: boolean) => Promise<void>;
}) {
    const vm = VARIANT_META[variant];
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    const { regularItems, guestItems } = useMemo(() => {
        const sorted = activePlayerId
            ? [...items].sort((a, b) => {
                if (a.playerId === activePlayerId) return -1;
                if (b.playerId === activePlayerId) return 1;
                return 0;
            })
            : items;
        return {
            regularItems: sorted.filter((p) => !p.isGuest),
            guestItems:   sorted.filter((p) => p.isGuest),
        };
    }, [items, activePlayerId]);

    // ── Player row ────────────────────────────────────────────────────────────

    function PlayerRow({ p, isGuestRow = false }: { p: PlayerInMatchDto; isGuestRow?: boolean }) {
        const pid      = p.playerId;
        const name     = p.playerName || "—";
        const isMe     = pid === activePlayerId;
        const canAct   = canUserActOnPlayer(isAdmin, activePlayerId, pid);
        const busy     = !!mutatingInvite[pid];
        const showAccept = canAct && (variant === "pending" || variant === "rejected");
        const showReject = canAct && (variant === "pending" || variant === "accepted");

        return (
            <div
                className={cls(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    "bg-white dark:bg-slate-800/60",
                    "border border-slate-100 dark:border-slate-700/60",
                    "hover:bg-slate-50 dark:hover:bg-slate-800",
                    isMe && "ring-1 ring-blue-300 dark:ring-blue-600/60"
                )}
            >
                {/* Avatar */}
                <div
                    className={cls(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none",
                        isGuestRow
                            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                            : vm.avatarBg
                    )}
                >
                    {initials(name)}
                </div>

                {/* Name + badges */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cls(
                            "font-medium text-sm truncate text-slate-900 dark:text-slate-100",
                            isMe && "font-semibold"
                        )}>
                            {name}
                        </span>

                        {/* Role icon (goalkeeper toggle) */}
                        {isAdmin && onSetPlayerRole ? (
                            <button
                                title={p.isGoalkeeper
                                    ? "Goleiro — clique para mudar para linha"
                                    : "Linha — clique para mudar para goleiro"}
                                className="leading-none cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                                onClick={() => onSetPlayerRole(p.matchPlayerId, !p.isGoalkeeper)}
                            >
                                <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? "goalkeeper" : "player")} size={14} />
                            </button>
                        ) : (
                            p.isGoalkeeper && (
                                <span title="Goleiro" className="leading-none opacity-70">
                                    <IconRenderer value={resolveIcon(_icons, "goalkeeper")} size={14} />
                                </span>
                            )
                        )}

                        {isMe && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                Você
                            </span>
                        )}
                        {isGuestRow && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                                Convidado
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {showReject && (
                        <button
                            className={cls(
                                "flex items-center justify-center w-7 h-7 rounded-lg border transition-colors",
                                "border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400",
                                busy && "opacity-40 pointer-events-none"
                            )}
                            title="Recusar"
                            disabled={busy}
                            onClick={() => onReject(pid)}
                        >
                            <X size={13} />
                        </button>
                    )}
                    {showAccept && (
                        <button
                            className={cls(
                                "flex items-center justify-center w-7 h-7 rounded-lg border transition-colors",
                                "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
                                busy && "opacity-40 pointer-events-none"
                            )}
                            title="Aceitar"
                            disabled={busy}
                            onClick={() => onAccept(pid)}
                        >
                            <Check size={13} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────────

    const isEmpty = regularItems.length === 0 && guestItems.length === 0;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={cls(
            "flex flex-col rounded-2xl overflow-hidden",
            "bg-white dark:bg-slate-900/60",
            "border border-slate-200 dark:border-slate-700/60",
            "shadow-sm dark:shadow-none",
            vm.accent
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                    <span className={cls("font-semibold text-sm", vm.headerColor)}>
                        {title}
                    </span>
                </div>
                <span className={cls(
                    "inline-flex items-center justify-center min-w-[1.4rem] h-5 rounded-full px-1.5 text-[11px] font-bold",
                    vm.countBg
                )}>
                    {items.length}
                </span>
            </div>

            {/* Body */}
            <div className="p-3 flex flex-col gap-1.5">
                {isEmpty && (
                    <div className="py-6 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-600">
                        <Users size={20} strokeWidth={1.5} />
                        <span className="text-xs">Nenhum jogador</span>
                    </div>
                )}

                {regularItems.map((p) => (
                    <PlayerRow key={p.playerId} p={p} />
                ))}

                {guestItems.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Convidados
                            </span>
                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/60" />
                        </div>
                        {guestItems.map((p) => (
                            <PlayerRow key={p.playerId} p={p} isGuestRow />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
