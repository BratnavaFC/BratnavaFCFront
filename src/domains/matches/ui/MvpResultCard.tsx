import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";
import type { VoteCountDto, VoteDto } from "../matchTypes";

function cls(...c: (string | false | undefined)[]) {
    return c.filter(Boolean).join(" ");
}

export function MvpResultCard({
    mvpNames,
    teamName,
    voteCounts = [],
    votes = [],
    admin,
    allVotedBadge = false,
    _icons,
}: {
    mvpNames?: string[] | null;
    teamName?: string;
    /** Sempre passar — admin vê contagens, user só vê nomes dos empatados */
    voteCounts?: VoteCountDto[];
    votes?: VoteDto[];
    /** true = mostrar apuração de votos (barras + números) */
    admin: boolean;
    allVotedBadge?: boolean;
    _icons: ReturnType<typeof useGroupIcons>;
}) {
    const maxVotes   = voteCounts.length > 0 ? (voteCounts[0].count ?? 0) : 0;
    const hasMvp     = !!mvpNames && mvpNames.length > 0;
    const mvpIsTie   = hasMvp && mvpNames!.length > 1;          // múltiplos MVPs eleitos
    const voteTie    = !hasMvp && voteCounts.length > 0 && maxVotes > 0; // empate → nenhum MVP
    const tiedPlayers = voteTie ? voteCounts.filter(v => v.count === maxVotes) : [];
    const mvpNamesSet = new Set(mvpNames ?? []);

    return (
        <div className="space-y-3">

            {/* ── Estado principal ─────────────────────────────────── */}
            {hasMvp ? (
                /* MVP eleito */
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center h-11 w-11 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 shrink-0 mt-0.5">
                            <IconRenderer value={resolveIcon(_icons, "mvp")} size={20}
                                lucideProps={{ className: "text-amber-500 dark:text-amber-400" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                    {mvpIsTie ? "MVPs do jogo" : "Melhor do jogo"}
                                </div>
                                {allVotedBadge && (
                                    <span className="text-[9px] font-semibold bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                        Todos votaram!
                                    </span>
                                )}
                                {mvpIsTie && (
                                    <span className="text-[9px] font-semibold bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                                        Empate
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 space-y-0.5">
                                {mvpNames!.map((name, i) => (
                                    <div key={i} className="font-bold text-slate-900 dark:text-amber-50 text-xl leading-none">
                                        {name}
                                    </div>
                                ))}
                            </div>
                            {!mvpIsTie && teamName && (
                                <div className="text-xs text-amber-700 dark:text-amber-400/70 mt-1">{teamName}</div>
                            )}
                        </div>
                    </div>
                </div>

            ) : voteTie ? (
                /* Empate nos votos — nenhum MVP eleito */
                <div className="rounded-xl border border-dashed border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 px-4 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700 shrink-0">
                            <IconRenderer value={resolveIcon(_icons, "mvp")} size={18}
                                lucideProps={{ className: "text-orange-400 dark:text-orange-500" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                                    Empate — Nenhum MVP eleito
                                </span>
                                {allVotedBadge && (
                                    <span className="text-[9px] font-semibold bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                                        Todos votaram!
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-orange-700 dark:text-orange-400/80 mb-2">
                                Mais votados:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {tiedPlayers.map(v => (
                                    <span key={v.votedForMatchPlayerId}
                                        className="text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-700/50">
                                        {v.votedForName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            ) : (
                /* Sem votos ainda */
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-8 text-center">
                    <IconRenderer value={resolveIcon(_icons, "mvp")} size={28}
                        lucideProps={{ className: "mx-auto text-slate-300 dark:text-slate-600 mb-2" }} />
                    <div className="text-sm text-slate-400 dark:text-slate-500">MVP não definido</div>
                </div>
            )}

            {/* ── Apuração de votos — apenas admin ────────────────── */}
            {admin && voteCounts.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                        Apuração de votos
                    </div>
                    <div className="space-y-2.5">
                        {voteCounts.map((vc) => {
                            const pct      = maxVotes > 0 ? (vc.count / maxVotes) * 100 : 0;
                            const isWinner = hasMvp && mvpNamesSet.has(vc.votedForName);
                            const isTied   = voteTie && tiedPlayers.some(t => t.votedForMatchPlayerId === vc.votedForMatchPlayerId);
                            return (
                                <div key={vc.votedForMatchPlayerId} className="flex items-center gap-3">
                                    <div className="w-28 sm:w-36 text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 shrink-0">
                                        {(isWinner || isTied) && (
                                            <IconRenderer value={resolveIcon(_icons, "mvp")} size={11}
                                                lucideProps={{ className: cls(isWinner ? "text-amber-400" : "text-orange-400", "shrink-0") }} />
                                        )}
                                        {vc.votedForName}
                                    </div>
                                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                        <div className={cls(
                                            "h-full rounded-full transition-all",
                                            isWinner ? "bg-amber-400" : isTied ? "bg-orange-300 dark:bg-orange-500" : "bg-slate-300 dark:bg-slate-600"
                                        )} style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums w-5 text-right shrink-0">
                                        {vc.count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {votes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1.5">Detalhamento</div>
                            <div className="grid gap-1">
                                {votes.map((v) => (
                                    <div key={v.voteId} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="truncate">{v.voterName}</span>
                                        <span className="text-slate-300 dark:text-slate-600">→</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{v.votedForName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
