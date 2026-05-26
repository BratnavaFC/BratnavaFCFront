import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, CalendarDays, Check, Link2, Loader2, Plus, X } from "lucide-react";
import { PollsApi, MatchesApi } from "../../../api/endpoints";
import { cls } from "../matchUtils";
import PollDetailModal from "../../../components/modals/PollDetailModal";

// ── Re-uses the same Poll shape as PollDetailModal / PollsPage ────────────────

interface PollOption {
    id: string;
    text: string;
    description?: string | null;
    images: string[];
    sortOrder: number;
    voteCount: number;
}

interface PollVote {
    optionId: string;
    playerId: string;
    playerName: string;
}

interface PollMemberVote {
    playerId: string;
    playerName: string;
    votedOptionIds: string[];
}

interface Poll {
    id: string;
    title: string;
    description?: string | null;
    allowMultipleVotes: boolean;
    showVotes: boolean;
    status: string;
    deadlineDate?: string | null;
    deadlineTime?: string | null;
    createDate: string;
    options: PollOption[];
    votes?: PollVote[] | null;
    myVotedOptionIds: string[];
    totalVoters: number;
    type: "poll" | "event";
    eventDate?: string | null;
    eventTime?: string | null;
    eventLocation?: string | null;
    eventIcon?: string | null;
    costType?: string | null;
    costAmount?: number | null;
    members?: PollMemberVote[] | null;
    linkedMatchId?: string | null;
}

interface PollListItem {
    id: string;
    title: string;
    status: "open" | "closed";
    totalVoters: number;
    optionCount: number;
    type: "poll" | "event";
}

// ── LinkPollModal — admin picks a poll to link ────────────────────────────────

function LinkPollModal({
    groupId,
    matchId,
    currentPollId,
    onClose,
    onLinked,
}: {
    groupId: string;
    matchId: string;
    currentPollId?: string | null;
    onClose: () => void;
    onLinked: (pollId: string) => void;
}) {
    const navigate = useNavigate();
    const [polls, setPolls]     = useState<PollListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    useEffect(() => {
        PollsApi.getPolls(groupId)
            .then((res) => {
                const list = ((res.data as any)?.data ?? res.data) as PollListItem[];
                // Only open polls/events can be linked
                setPolls(list.filter((p) => p.status === "open"));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [groupId]);

    async function handleLink(pollId: string) {
        setLinking(pollId);
        try {
            await MatchesApi.setLinkedPoll(groupId, matchId, pollId);
            onLinked(pollId);
        } catch {
            // parent handles toast
        } finally {
            setLinking(null);
        }
    }

    function goCreatePoll() {
        onClose();
        navigate("../polls");
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Link2 size={16} className="text-indigo-500" />
                        <span className="font-semibold text-slate-900 dark:text-white">Vincular votação ou evento</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-slate-400" />
                        </div>
                    ) : polls.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <p className="text-sm text-slate-400">
                                Nenhuma votação ou evento <strong>aberta</strong> neste grupo.
                            </p>
                            <button
                                onClick={goCreatePoll}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition"
                            >
                                <Plus size={12} />
                                Criar votação ou evento
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {polls.map((poll) => {
                                const isCurrent = poll.id === currentPollId;
                                const isLinking = linking === poll.id;

                                return (
                                    <div
                                        key={poll.id}
                                        className={cls(
                                            "flex items-center gap-3 rounded-xl border px-3 py-3 transition",
                                            isCurrent
                                                ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40"
                                        )}
                                    >
                                        {poll.type === "event"
                                            ? <CalendarDays size={15} className="text-indigo-500 shrink-0" />
                                            : <BarChart2 size={15} className="text-indigo-500 shrink-0" />
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{poll.title}</p>
                                            <span className="text-[10px] text-slate-400">
                                                {poll.totalVoters} respostas · {poll.optionCount} opções
                                            </span>
                                        </div>

                                        {isCurrent ? (
                                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium shrink-0">Vinculada</span>
                                        ) : (
                                            <button
                                                onClick={() => handleLink(poll.id)}
                                                disabled={!!linking}
                                                className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition"
                                            >
                                                {isLinking
                                                    ? <Loader2 size={11} className="animate-spin" />
                                                    : <Plus size={11} />}
                                                Vincular
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Shortcut to create if needed */}
                            <button
                                onClick={goCreatePoll}
                                className="w-full flex items-center justify-center gap-1.5 mt-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-medium text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
                            >
                                <Plus size={12} />
                                Criar nova votação ou evento
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── LinkedPollWidget (exported) ───────────────────────────────────────────────

export function LinkedPollWidget({
    groupId,
    matchId,
    linkedPollId,
    admin,
    onPollIdChange,
}: {
    groupId: string;
    matchId: string;
    linkedPollId?: string | null;
    admin: boolean;
    /** Called after link/unlink so parent can update its local state */
    onPollIdChange: (pollId: string | null) => void;
}) {
    const [poll,         setPoll]         = useState<Poll | null>(null);
    const [loadingPoll,  setLoadingPoll]  = useState(false);
    const [showDetail,   setShowDetail]   = useState(false);
    const [showLinkPick, setShowLinkPick] = useState(false);
    const [unlinking,    setUnlinking]    = useState(false);

    // Fetch full poll whenever linkedPollId changes
    useEffect(() => {
        if (!linkedPollId) { setPoll(null); return; }
        setLoadingPoll(true);
        PollsApi.getPoll(groupId, linkedPollId)
            .then((res) => {
                const data = (res.data as any)?.data ?? res.data;
                setPoll(data as Poll);
            })
            .catch(() => setPoll(null))
            .finally(() => setLoadingPoll(false));
    }, [groupId, linkedPollId]);

    async function handleUnlink() {
        setUnlinking(true);
        try {
            await MatchesApi.setLinkedPoll(groupId, matchId, null);
            onPollIdChange(null);
        } catch {
            // parent handles toast if needed
        } finally {
            setUnlinking(false);
        }
    }

    function handleLinked(pollId: string) {
        setShowLinkPick(false);
        onPollIdChange(pollId);
    }

    // ── No poll linked ────────────────────────────────────────────────────────
    if (!linkedPollId) {
        if (!admin) return null;
        return (
            <>
                <button
                    type="button"
                    onClick={() => setShowLinkPick(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                    <Link2 size={13} />
                    Vincular votação ou evento
                </button>

                {showLinkPick && (
                    <LinkPollModal
                        groupId={groupId}
                        matchId={matchId}
                        currentPollId={linkedPollId}
                        onClose={() => setShowLinkPick(false)}
                        onLinked={handleLinked}
                    />
                )}
            </>
        );
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loadingPoll) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
                <Loader2 size={13} className="animate-spin text-indigo-400 shrink-0" />
                <span className="text-xs text-indigo-500">Carregando votação vinculada...</span>
            </div>
        );
    }

    // ── Poll was deleted externally ───────────────────────────────────────────
    if (!poll) {
        if (!admin) return null;
        return (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                <span className="text-xs text-amber-600 dark:text-amber-400">Votação vinculada não encontrada.</span>
                <button
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium"
                >
                    {unlinking ? "Removendo..." : "Remover vínculo"}
                </button>
            </div>
        );
    }

    // ── Poll linked — strip ───────────────────────────────────────────────────
    const isOpen   = poll.status === "open";
    const hasVoted = poll.myVotedOptionIds?.length > 0;

    return (
        <>
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/60 dark:bg-indigo-900/15 px-3 py-2">
                {poll.type === "event"
                    ? <CalendarDays size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                    : <BarChart2 size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                }

                {/* Clickable strip → opens detail modal */}
                <button
                    type="button"
                    onClick={() => setShowDetail(true)}
                    className="flex-1 min-w-0 text-left flex items-center gap-2 flex-wrap"
                >
                    <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate max-w-[180px]">
                        {poll.title}
                    </span>

                    <span className={cls(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
                        isOpen
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700/50"
                            : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                    )}>
                        {isOpen ? "Aberta" : "Encerrada"}
                    </span>

                    {hasVoted && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-700/50 flex items-center gap-0.5 shrink-0">
                            <Check size={8} strokeWidth={3} /> Votou
                        </span>
                    )}

                    <span className="text-[10px] text-indigo-400 dark:text-indigo-500 shrink-0">
                        {poll.totalVoters} {poll.totalVoters === 1 ? "resposta" : "respostas"} · abrir →
                    </span>
                </button>

                {/* Admin: unlink */}
                {admin && (
                    <button
                        type="button"
                        onClick={handleUnlink}
                        disabled={unlinking}
                        title="Desvincular votação"
                        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                    >
                        {unlinking
                            ? <Loader2 size={13} className="animate-spin" />
                            : <X size={13} />}
                    </button>
                )}
            </div>

            {/* Full poll detail modal */}
            {showDetail && (
                <PollDetailModal
                    poll={poll}
                    groupId={groupId}
                    isAdmin={admin}
                    onClose={() => setShowDetail(false)}
                    onUpdated={(updated) => setPoll(updated as Poll)}
                />
            )}

            {/* Link picker (admin changes the linked poll) */}
            {showLinkPick && (
                <LinkPollModal
                    groupId={groupId}
                    matchId={matchId}
                    currentPollId={linkedPollId}
                    onClose={() => setShowLinkPick(false)}
                    onLinked={handleLinked}
                />
            )}
        </>
    );
}
