import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Vote, Plus, X, Loader2, Check, Lock, Unlock,
    CalendarPlus, Users, ChevronRight,
    Eye, EyeOff, RefreshCw,
    CheckSquare, Clock, DollarSign, CalendarDays,
    MapPin, BarChart2, Link,
} from 'lucide-react';
import useAccountStore from '../auth/accountStore';
import { PollsApi } from '../api/endpoints';
import { usePollStore } from '../stores/pollStore';
import { extractApiError } from '../lib/apiError';
import PollEventDetailModal from '../components/modals/PollEventDetailModal';
import PollCreateEventModal from '../components/modals/PollCreateEventModal';
import PollDetailModal from '../components/modals/PollDetailModal';
import PollCreatePollModal from '../components/modals/PollCreatePollModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PollSummary {
    id: string;
    title: string;
    description?: string | null;
    allowMultipleVotes: boolean;
    showVotes: boolean;
    status: 'open' | 'closed';
    deadlineDate?: string | null;
    deadlineTime?: string | null;
    optionCount: number;
    totalVoters: number;
    hasVoted: boolean;
    createDate: string;
    type: 'poll' | 'event';
    eventDate?: string | null;
    eventTime?: string | null;
    eventLocation?: string | null;
    eventIcon?: string | null;
    costType?: string | null;
    costAmount?: number | null;
}

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
    type: 'poll' | 'event';
    eventDate?: string | null;
    eventTime?: string | null;
    eventLocation?: string | null;
    eventIcon?: string | null;
    costType?: string | null;
    costAmount?: number | null;
    members?: PollMemberVote[] | null; // somente para admins
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function isDeadlinePassed(deadlineDate?: string | null, deadlineTime?: string | null): boolean {
    if (!deadlineDate) return false;
    const timeStr = deadlineTime ?? '23:59';
    const deadline = new Date(`${deadlineDate}T${timeStr}:00`);
    return Date.now() > deadline.getTime();
}

function formatDeadline(deadlineDate?: string | null, deadlineTime?: string | null): string | null {
    if (!deadlineDate) return null;
    const [y, m, d] = deadlineDate.split('-');
    const dateStr = `${d}/${m}/${y}`;
    return deadlineTime ? `${dateStr} às ${deadlineTime}` : dateStr;
}

function formatCost(costType?: string | null, costAmount?: number | null): string | null {
    if (!costType) return null;
    const label = costType === 'individual' ? 'por pessoa' : 'rateio grupo';
    if (costAmount) return `R$ ${costAmount.toFixed(2)} ${label}`;
    return label;
}

// ─── Share URL ────────────────────────────────────────────────────────────────

function buildPollShareUrl(pollId: string): string {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#/app/polls?poll=${pollId}`;
}

async function copyPollLink(pollId: string) {
    try {
        await navigator.clipboard.writeText(buildPollShareUrl(pollId));
        toast.success('Link copiado!');
    } catch {
        toast.error('Não foi possível copiar o link.');
    }
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ poll, onClick, loadingId }: { poll: PollSummary; onClick: () => void; loadingId: string | null }) {
    const isOpen = poll.status === 'open';
    const isLoading = loadingId === poll.id;
    const isDisabled = !!loadingId;
    const deadlinePassed = isDeadlinePassed(poll.deadlineDate, poll.deadlineTime);
    const icon = poll.eventIcon ?? '📅';
    const cost = formatCost(poll.costType, poll.costAmount);

    return (
        <div
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            onClick={isDisabled ? undefined : onClick}
            onKeyDown={(e) => !isDisabled && (e.key === 'Enter' || e.key === ' ') && onClick()}
            className={`w-full text-left px-4 py-4 transition-colors group flex items-stretch gap-3 ${isDisabled ? 'opacity-70 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'}`}
        >
            {/* Left: icon + date */}
            <div className="flex flex-col items-center gap-1 shrink-0 w-14">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                    {icon}
                </div>
                {poll.eventDate && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-center leading-tight">
                        {formatEventDate(poll.eventDate)}
                    </span>
                )}
            </div>

            {/* Center: info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{poll.title}</p>
                    {poll.hasVoted && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-0.5">
                            <Check size={8} strokeWidth={3} /> Respondeu
                        </span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                        {isOpen ? 'Aberto' : 'Encerrado'}
                    </span>
                </div>
                {poll.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{poll.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {poll.eventLocation && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                            <MapPin size={10} /> {poll.eventLocation}
                        </span>
                    )}
                    {cost && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-0.5">
                            <DollarSign size={9} /> {cost}
                        </span>
                    )}
                    {poll.deadlineDate && (
                        <span className={`text-[10px] flex items-center gap-0.5 font-medium ${deadlinePassed ? 'text-rose-400' : 'text-amber-500'}`}>
                            <Clock size={9} /> {deadlinePassed ? 'Prazo encerrado' : `Prazo: ${formatDeadline(poll.deadlineDate, poll.deadlineTime)}`}
                        </span>
                    )}
                </div>
            </div>

            {/* Right: responses + share + chevron */}
            <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Users size={11} /> {poll.totalVoters} respostas
                </span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="Compartilhar link"
                        onClick={(e) => { e.stopPropagation(); copyPollLink(poll.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <Link size={13} className="text-slate-400 dark:text-slate-500" />
                    </button>
                    {isLoading
                        ? <Loader2 size={15} className="text-slate-400 animate-spin" />
                        : <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-400" />
                    }
                </div>
            </div>
        </div>
    );
}

// ─── PollCard ─────────────────────────────────────────────────────────────────

function PollCard({ poll, onClick, loadingId }: { poll: PollSummary; onClick: () => void; loadingId: string | null }) {
    const isOpen = poll.status === 'open';
    const isLoading = loadingId === poll.id;
    const isDisabled = !!loadingId;

    return (
        <div
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            onClick={isDisabled ? undefined : onClick}
            onKeyDown={(e) => !isDisabled && (e.key === 'Enter' || e.key === ' ') && onClick()}
            className={`w-full text-left px-5 py-4 transition-colors group flex items-center gap-3 ${isDisabled ? 'opacity-70 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'}`}
        >
            {/* Status dot */}
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isOpen ? 'bg-emerald-400' : 'bg-slate-300'}`} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{poll.title}</p>
                    {poll.hasVoted && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-0.5">
                            <Check size={8} strokeWidth={3} /> Votou
                        </span>
                    )}
                </div>
                {poll.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{poll.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                    <span>{poll.optionCount} opç{poll.optionCount !== 1 ? 'ões' : 'ão'}</span>
                    <span>·</span>
                    <span>{poll.totalVoters} votante{poll.totalVoters !== 1 ? 's' : ''}</span>
                    {poll.allowMultipleVotes && <><span>·</span><span className="flex items-center gap-0.5"><CheckSquare size={9} /> Múltipla</span></>}
                    {poll.showVotes && <><span>·</span><span className="flex items-center gap-0.5"><Eye size={9} /> Público</span></>}
                    {poll.deadlineDate && (() => {
                        const passed = isDeadlinePassed(poll.deadlineDate, poll.deadlineTime);
                        return <><span>·</span><span className={`flex items-center gap-0.5 font-medium ${passed ? 'text-rose-400' : 'text-amber-500'}`}><Clock size={9} />{passed ? 'Prazo encerrado' : formatDeadline(poll.deadlineDate, poll.deadlineTime)}</span></>;
                    })()}
                </div>
            </div>

            {/* Share + chevron/loader */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    title="Compartilhar link"
                    onClick={(e) => { e.stopPropagation(); copyPollLink(poll.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    <Link size={13} className="text-slate-400 dark:text-slate-500" />
                </button>
                {isLoading
                    ? <Loader2 size={15} className="text-slate-400 animate-spin" />
                    : <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-400" />
                }
            </div>
        </div>
    );
}

// ─── PollsPage ────────────────────────────────────────────────────────────────

export default function PollsPage() {
    const store = useAccountStore();
    const active = store.getActive();
    const groupId = active?.activeGroupId ?? null;

    const roles = useAccountStore(s => s.accounts.find(a => a.userId === s.activeAccountId)?.roles ?? []);
    const grpAdminIds = useAccountStore(s => s.accounts.find(a => a.userId === s.activeAccountId)?.groupAdminIds ?? []);
    const isAdminOrGod = roles.includes('Admin') || roles.includes('GodMode');
    const isAdmin = isAdminOrGod || (!!groupId && grpAdminIds.includes(groupId));

    const setPendingPollsCount = usePollStore((s) => s.setPendingPollsCount);

    const [searchParams] = useSearchParams();
    const hasAutoOpened = useRef(false);

    const [polls, setPolls] = useState<PollSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showCreateEvent, setShowCreateEvent] = useState(false);
    const [activeTab, setActiveTab] = useState<'events' | 'polls'>('events');

    const eventPolls = polls.filter(p => p.type === 'event');
    const votePolls = polls.filter(p => p.type === 'poll' || !p.type);
    const tabPolls = activeTab === 'events' ? eventPolls : votePolls;

    const openCount = tabPolls.filter(p => p.status === 'open').length;
    const closedCount = tabPolls.filter(p => p.status === 'closed').length;

    const load = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await PollsApi.getPolls(groupId);
            const list: PollSummary[] = res.data.data ?? [];
            setPolls(list);
            setPendingPollsCount(list.filter(p => p.status === 'open' && !p.hasVoted).length);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao carregar votações.'));
        } finally { setLoading(false); }
    }, [groupId, setPendingPollsCount]);

    useEffect(() => { load(); }, [load]);

    // Auto-abre a votação indicada por ?poll=<pollId> na URL
    useEffect(() => {
        if (hasAutoOpened.current || polls.length === 0) return;
        const pollId = searchParams.get('poll');
        if (!pollId) return;
        const found = polls.find(p => p.id === pollId);
        if (!found) return;
        hasAutoOpened.current = true;
        setActiveTab(found.type === 'event' ? 'events' : 'polls');
        openPollDetail(found);
    // openPollDetail é estável dentro do mesmo render — não precisa ser dependência
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polls, searchParams]);

    async function openPollDetail(summary: PollSummary) {
        if (!groupId) return;
        setLoadingDetail(true);
        try {
            const res = await PollsApi.getPoll(groupId, summary.id);
            setSelectedPoll(res.data.data);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao abrir.'));
        } finally { setLoadingDetail(false); }
    }

    function handlePollUpdated(updated: Poll) {
        setSelectedPoll(updated);
        load();
    }

    function handlePollCreated(poll: Poll) {
        load();
        setSelectedPoll(poll);
    }

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="page-header">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon">
                            {activeTab === 'events' ? <CalendarDays size={18} /> : <Vote size={18} />}
                        </div>
                        <div>
                            <h1 className="text-xl font-black leading-tight">Eventos &amp; Votações</h1>
                            <p className="text-xs text-white/60 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : !groupId ? 'Selecione um grupo'
                                    : `${eventPolls.length} evento${eventPolls.length !== 1 ? 's' : ''} · ${votePolls.length} votaç${votePolls.length !== 1 ? 'ões' : 'ão'}`
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {groupId && (
                            <button
                                type="button"
                                onClick={load}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            </button>
                        )}
                        {isAdmin && groupId && (
                            <button
                                type="button"
                                onClick={() => activeTab === 'events' ? setShowCreateEvent(true) : setShowCreate(true)}
                                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-white text-slate-900 border-transparent hover:bg-slate-100 transition-colors"
                            >
                                <Plus size={15} />
                                {activeTab === 'events' ? 'Novo evento' : 'Nova votação'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                {groupId && (
                    <div className="relative mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('events')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors border ${
                                activeTab === 'events'
                                    ? 'bg-white text-slate-900 border-white'
                                    : 'bg-transparent text-white/70 border-white/30 hover:bg-white/10'
                            }`}
                        >
                            <CalendarDays size={14} /> Eventos
                            {eventPolls.length > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'events' ? 'bg-slate-900 text-white' : 'bg-white/20 text-white'}`}>
                                    {eventPolls.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('polls')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors border ${
                                activeTab === 'polls'
                                    ? 'bg-white text-slate-900 border-white'
                                    : 'bg-transparent text-white/70 border-white/30 hover:bg-white/10'
                            }`}
                        >
                            <Vote size={14} /> Votações
                            {votePolls.length > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'polls' ? 'bg-slate-900 text-white' : 'bg-white/20 text-white'}`}>
                                    {votePolls.length}
                                </span>
            )}
                        </button>
                    </div>
                )}
            </div>

            {/* ── No group ── */}
            {!groupId && (
                <div className="card p-10 flex flex-col items-center gap-3 text-slate-400 shadow-sm">
                    <Vote size={36} className="opacity-30" />
                    <span className="text-sm">Selecione um grupo no Dashboard.</span>
                </div>
            )}

            {/* ── Loading skeletons ── */}
            {groupId && loading && (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── Empty ── */}
            {groupId && !loading && tabPolls.length === 0 && (
                <div className="card p-12 flex flex-col items-center gap-3 text-slate-400 shadow-sm">
                    {activeTab === 'events' ? <CalendarDays size={40} className="opacity-20" /> : <Vote size={40} className="opacity-20" />}
                    <div className="text-center">
                        <p className="text-sm font-medium">
                            {activeTab === 'events' ? 'Nenhum evento ainda' : 'Nenhuma votação ainda'}
                        </p>
                        {isAdmin && (
                            <p className="text-xs text-slate-400 mt-1">
                                Clique em <strong>{activeTab === 'events' ? 'Novo evento' : 'Nova votação'}</strong> para criar.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── List ── */}
            {groupId && !loading && tabPolls.length > 0 && (
                <div className="space-y-4">
                    {/* Open */}
                    {tabPolls.filter(p => p.status === 'open').length > 0 && (
                        <div className="card p-0 overflow-hidden shadow-sm">
                            <div className="px-5 py-3 border-b bg-slate-50/80 flex items-center gap-2">
                                <div className="h-5 w-5 rounded-md bg-emerald-500 flex items-center justify-center">
                                    <Unlock size={11} className="text-white" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{activeTab === 'events' ? 'Abertos' : 'Abertas'}</span>
                                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    {openCount}
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {tabPolls.filter(p => p.status === 'open').map(poll =>
                                    activeTab === 'events'
                                        ? <EventCard key={poll.id} poll={poll} onClick={() => openPollDetail(poll)} loadingId={loadingDetail ? poll.id : null} />
                                        : <PollCard key={poll.id} poll={poll} onClick={() => openPollDetail(poll)} loadingId={loadingDetail ? poll.id : null} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Closed */}
                    {tabPolls.filter(p => p.status === 'closed').length > 0 && (
                        <div className="card p-0 overflow-hidden shadow-sm">
                            <div className="px-5 py-3 border-b bg-slate-50/80 flex items-center gap-2">
                                <div className="h-5 w-5 rounded-md bg-slate-400 flex items-center justify-center">
                                    <Lock size={11} className="text-white" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{activeTab === 'events' ? 'Encerrados' : 'Encerradas'}</span>
                                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                    {closedCount}
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {tabPolls.filter(p => p.status === 'closed').map(poll =>
                                    activeTab === 'events'
                                        ? <EventCard key={poll.id} poll={poll} onClick={() => openPollDetail(poll)} loadingId={loadingDetail ? poll.id : null} />
                                        : <PollCard key={poll.id} poll={poll} onClick={() => openPollDetail(poll)} loadingId={loadingDetail ? poll.id : null} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Detail modals ── */}
            {selectedPoll && groupId && selectedPoll.type === 'event' && (
                <PollEventDetailModal
                    poll={selectedPoll}
                    groupId={groupId}
                    isAdmin={isAdmin}
                    onClose={() => { setSelectedPoll(null); load(); }}
                    onUpdated={handlePollUpdated}
                />
            )}
            {selectedPoll && groupId && selectedPoll.type !== 'event' && (
                <PollDetailModal
                    poll={selectedPoll}
                    groupId={groupId}
                    isAdmin={isAdmin}
                    onClose={() => { setSelectedPoll(null); load(); }}
                    onUpdated={handlePollUpdated}
                />
            )}

            {/* ── Create modals ── */}
            {showCreate && groupId && (
                <PollCreatePollModal
                    groupId={groupId}
                    onClose={() => setShowCreate(false)}
                    onCreate={handlePollCreated}
                />
            )}
            {showCreateEvent && groupId && (
                <PollCreateEventModal
                    groupId={groupId}
                    onClose={() => setShowCreateEvent(false)}
                    onCreate={handlePollCreated}
                />
            )}
        </div>
    );
}
