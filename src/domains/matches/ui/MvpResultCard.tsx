import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";
import type { VoteCountDto, VoteDto } from "../matchTypes";

function cls(...c: (string | false | undefined)[]) {
    return c.filter(Boolean).join(" ");
}

export function MvpResultCard({
    mvpName,
    teamName,
    voteCounts = [],
    votes = [],
    admin,
    allVotedBadge = false,
    _icons,
}: {
    mvpName?: string | null;
    teamName?: string;
    voteCounts?: VoteCountDto[];
    votes?: VoteDto[];
    admin: boolean;
    /** Mostra badge "Todos votaram!" — para contexto pós-jogo */
    allVotedBadge?: boolean;
    _icons: ReturnType<typeof useGroupIcons>;
}) {
    const maxVotes = voteCounts.length > 0 ? (voteCounts[0].count ?? 0) : 0;

    return (
        <div className="space-y-3">
            {/* Winner card */}
            {mvpName ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-11 w-11 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 shrink-0">
                            <IconRenderer
                                value={resolveIcon(_icons, "mvp")}
                                size={20}
                                lucideProps={{ className: "text-amber-500 dark:text-amber-400" }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                    Melhor do jogo
                                </div>
                                {allVotedBadge && (
                                    <span className="text-[9px] font-semibold bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                        Todos votaram!
                                    </span>
                                )}
                            </div>
                            <div className="font-bold text-slate-900 dark:text-amber-50 text-xl leading-none mt-0.5">
                                {mvpName}
                            </div>
                            {teamName && (
                                <div className="text-xs text-amber-700 dark:text-amber-400/70 mt-1">
                                    {teamName}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-8 text-center">
                    <IconRenderer
                        value={resolveIcon(_icons, "mvp")}
                        size={28}
                        lucideProps={{ className: "mx-auto text-slate-300 dark:text-slate-600 mb-2" }}
                    />
                    <div className="text-sm text-slate-400 dark:text-slate-500">MVP não definido</div>
                </div>
            )}

            {/* Apuração de votos — apenas admin */}
            {admin && voteCounts.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                        Apuração de votos
                    </div>
                    <div className="space-y-2.5">
                        {voteCounts.map((vc) => {
                            const pct = maxVotes > 0 ? (vc.count / maxVotes) * 100 : 0;
                            const isWinner = !!mvpName && vc.votedForName === mvpName;
                            return (
                                <div key={vc.votedForMatchPlayerId} className="flex items-center gap-3">
                                    <div className="w-28 sm:w-36 text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 shrink-0">
                                        {isWinner && (
                                            <IconRenderer
                                                value={resolveIcon(_icons, "mvp")}
                                                size={11}
                                                lucideProps={{ className: "text-amber-400 shrink-0" }}
                                            />
                                        )}
                                        {vc.votedForName}
                                    </div>
                                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                        <div
                                            className={cls(
                                                "h-full rounded-full transition-all",
                                                isWinner ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600"
                                            )}
                                            style={{ width: `${pct}%` }}
                                        />
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
                            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                                Detalhamento
                            </div>
                            <div className="grid gap-1">
                                {votes.map((v) => (
                                    <div
                                        key={v.voteId}
                                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        <span className="truncate">{v.voterName}</span>
                                        <span className="text-slate-300 dark:text-slate-600">→</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                                            {v.votedForName}
                                        </span>
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
