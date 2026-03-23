import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Lock, Unlock, Trash2,
    Users, Clock, DollarSign, CalendarDays,
    MapPin, AlertCircle,
} from 'lucide-react';
import { PollsApi } from '../../api/endpoints';
import { extractApiError } from '../../lib/apiError';
import ModalBackdrop from './ModalBackdrop';
import PollClosePollModal from './PollClosePollModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PollOption {
    id: string;
    text: string;
    description?: string | null;
    imageUrl?: string | null;
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
    members?: PollMemberVote[] | null;
}

interface PollEventDetailModalProps {
    poll: Poll;
    groupId: string;
    isAdmin: boolean;
    onClose: () => void;
    onUpdated: (p: Poll) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(votes: number, total: number) {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
}

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

function getRsvpOption(options: PollOption[], myVotedOptionIds: string[]): string | null {
    const voted = options.find(o => myVotedOptionIds.includes(o.id));
    return voted?.text ?? null;
}

function formatCost(costType?: string | null, costAmount?: number | null): string | null {
    if (!costType) return null;
    const label = costType === 'individual' ? 'por pessoa' : 'rateio grupo';
    if (costAmount) return `R$ ${costAmount.toFixed(2)} ${label}`;
    return label;
}

// ─── AdminVotePanel ───────────────────────────────────────────────────────────

function AdminVotePanel({
    poll, groupId, onUpdated,
}: {
    poll: Poll;
    groupId: string;
    onUpdated: (p: Poll) => void;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);

    const members = poll.members ?? [];
    if (members.length === 0) return null;

    const votesMap = new Map<string, string[]>();
    (poll.votes ?? []).forEach(v => {
        const cur = votesMap.get(v.playerId) ?? [];
        cur.push(v.optionId);
        votesMap.set(v.playerId, cur);
    });

    function getVotedIds(playerId: string): string[] {
        return votesMap.get(playerId) ?? [];
    }

    const sortedMembers = [...members].sort((a, b) => {
        const aVoted = getVotedIds(a.playerId).length > 0 ? 0 : 1;
        const bVoted = getVotedIds(b.playerId).length > 0 ? 0 : 1;
        if (aVoted !== bVoted) return aVoted - bVoted;
        return a.playerName.localeCompare(b.playerName, 'pt-BR');
    });

    async function handleSetVote(playerId: string, optionIds: string[]) {
        setLoading(playerId);
        try {
            const res = await PollsApi.adminCastVote(groupId, poll.id, { playerId, optionIds });
            onUpdated(res.data.data);
            toast.success('Resposta atualizada!');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao atualizar resposta.'));
        } finally {
            setLoading(null);
        }
    }

    const isEvent = poll.type === 'event';

    const eventOptionColors: Record<string, string> = {};
    if (isEvent) {
        poll.options.forEach(o => {
            if (o.text === 'Sim') eventOptionColors[o.id] = 'bg-emerald-500 text-white';
            else if (o.text === 'Talvez') eventOptionColors[o.id] = 'bg-amber-400 text-white';
            else if (o.text === 'Não') eventOptionColors[o.id] = 'bg-rose-500 text-white';
            else eventOptionColors[o.id] = 'bg-slate-500 text-white';
        });
    }

    const votedCount    = members.filter(m => getVotedIds(m.playerId).length > 0).length;
    const notVotedCount = members.length - votedCount;

    return (
        <div className="border-t border-slate-100 dark:border-slate-700 mt-2">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                    <Users size={13} />
                    Gerenciar respostas
                    <span className="font-normal text-slate-400 dark:text-slate-500 normal-case tracking-normal text-[11px]">
                        {votedCount}/{members.length} responderam
                        {notVotedCount > 0 && <span className="text-amber-500"> · {notVotedCount} pendente{notVotedCount > 1 ? 's' : ''}</span>}
                    </span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6" /></svg>
            </button>

            {open && (
                <div className="px-5 pb-4 space-y-2 max-h-72 overflow-y-auto">
                    {sortedMembers.map(member => {
                        const isBusy = loading === member.playerId;
                        const votedIds = getVotedIds(member.playerId);
                        const hasVoted = votedIds.length > 0;

                        return (
                            <div key={member.playerId} className={`flex items-center gap-3 py-1.5 rounded-lg px-1 ${hasVoted ? '' : 'opacity-60'}`}>
                                <div className="relative shrink-0">
                                    <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-slate-200">
                                        {member.playerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-800 ${hasVoted ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{member.playerName}</span>

                                {isBusy ? (
                                    <Loader2 size={14} className="animate-spin text-slate-400" />
                                ) : isEvent ? (
                                    <div className="flex gap-1 shrink-0">
                                        {poll.options.map(opt => {
                                            const voted = votedIds.includes(opt.id);
                                            const baseColor = eventOptionColors[opt.id] ?? 'bg-slate-500 text-white';
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => handleSetVote(member.playerId, voted ? [] : [opt.id])}
                                                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all border ${
                                                        voted
                                                            ? baseColor + ' border-transparent scale-105'
                                                            : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                                    }`}
                                                >
                                                    {opt.text}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <select
                                        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white dark:bg-slate-700 dark:text-white max-w-[140px]"
                                        value={hasVoted ? votedIds[0] : ''}
                                        onChange={e => handleSetVote(member.playerId, e.target.value ? [e.target.value] : [])}
                                    >
                                        <option value="">Não votou</option>
                                        {poll.options.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.text}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── PollEventDetailModal ─────────────────────────────────────────────────────

function PollEventDetailModal({
    poll, groupId, isAdmin, onClose, onUpdated,
}: PollEventDetailModalProps) {
    const [voting, setVoting] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showClosePollModal, setShowClosePollModal] = useState(false);

    const deadlinePassed = isDeadlinePassed(poll.deadlineDate, poll.deadlineTime);
    const isOpen = poll.status === 'open' && !deadlinePassed;
    const cost = formatCost(poll.costType, poll.costAmount);

    const rsvpOptions = [...poll.options].sort((a, b) => a.sortOrder - b.sortOrder);
    const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
    const votedOptionText = getRsvpOption(poll.options, poll.myVotedOptionIds);
    const votedOptionId = poll.myVotedOptionIds[0] ?? null;

    const RSVP_CONFIG: Record<string, { icon: string; colorClass: string; bgClass: string; activeClass: string }> = {
        'Sim':    { icon: '✅', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100', activeClass: 'bg-emerald-600 border-emerald-600 text-white' },
        'Talvez': { icon: '🤔', colorClass: 'text-amber-700',   bgClass: 'bg-amber-50 border-amber-200 hover:bg-amber-100',     activeClass: 'bg-amber-500 border-amber-500 text-white' },
        'Não':    { icon: '❌', colorClass: 'text-rose-700',    bgClass: 'bg-rose-50 border-rose-200 hover:bg-rose-100',        activeClass: 'bg-rose-600 border-rose-600 text-white' },
    };

    const PROGRESS_COLORS: Record<string, string> = {
        'Sim':    '#10b981',
        'Talvez': '#f59e0b',
        'Não':    '#ef4444',
    };

    async function handleRsvp(optionId: string) {
        if (!isOpen) return;
        setVoting(true);
        try {
            if (votedOptionId === optionId) {
                const res = await PollsApi.removeVote(groupId, poll.id);
                onUpdated(res.data.data);
                toast.success('Resposta removida.');
            } else {
                const res = await PollsApi.castVote(groupId, poll.id, { optionIds: [optionId] });
                onUpdated(res.data.data);
                toast.success('Resposta registrada!');
            }
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao responder.'));
        } finally { setVoting(false); }
    }

    async function handleReopenPoll() {
        setActionLoading('reopen');
        try {
            await PollsApi.reopenPoll(groupId, poll.id);
            onClose();
            toast.success('Evento reaberto.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    async function handleClosePoll(dto: any) {
        setActionLoading('close');
        try {
            await PollsApi.closePoll(groupId, poll.id, dto);
            setShowClosePollModal(false);
            onClose();
            toast.success('Evento encerrado.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    async function handleDeletePoll() {
        if (!confirm(`Excluir o evento "${poll.title}"?`)) return;
        setActionLoading('delete');
        try {
            await PollsApi.deletePoll(groupId, poll.id);
            onClose();
            toast.success('Evento excluído.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    return (
        <>
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 flex flex-col overflow-hidden">
                {/* Drag handle */}
                <div className="sm:hidden flex justify-center pt-2">
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>

                {/* Header */}
                <div className="px-5 py-4 border-b dark:border-slate-700 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl shrink-0">
                                {poll.eventIcon ?? '📅'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                                        {isOpen ? 'Aberto' : 'Encerrado'}
                                    </span>
                                    {poll.deadlineDate && (
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${deadlinePassed ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                            <Clock size={9} />
                                            {deadlinePassed ? 'Prazo encerrado' : `Prazo: ${formatDeadline(poll.deadlineDate, poll.deadlineTime)}`}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{poll.title}</h2>
                                {poll.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{poll.description}</p>}
                            </div>
                        </div>
                        <button onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Event meta */}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {poll.eventDate && (
                            <span className="flex items-center gap-1.5">
                                <CalendarDays size={12} className="text-slate-400" />
                                {formatEventDate(poll.eventDate)}
                                {poll.eventTime && ` às ${poll.eventTime}`}
                            </span>
                        )}
                        {poll.eventLocation && (
                            <span className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-slate-400" />
                                {poll.eventLocation}
                            </span>
                        )}
                        {cost && (
                            <span className="flex items-center gap-1.5">
                                <DollarSign size={12} className="text-slate-400" />
                                {cost}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5">
                            <Users size={12} className="text-slate-400" />
                            {poll.totalVoters} resposta{poll.totalVoters !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* RSVP buttons */}
                    {isOpen && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sua resposta</p>
                            <div className="grid grid-cols-3 gap-2">
                                {rsvpOptions.map(opt => {
                                    const cfg = RSVP_CONFIG[opt.text] ?? { icon: '•', colorClass: 'text-slate-700', bgClass: 'bg-slate-50 border-slate-200 hover:bg-slate-100', activeClass: 'bg-slate-900 border-slate-900 text-white' };
                                    const isVoted = votedOptionId === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            disabled={voting}
                                            onClick={() => handleRsvp(opt.id)}
                                            className={`rounded-xl border-2 py-3 text-sm font-semibold flex flex-col items-center gap-1 transition-colors disabled:opacity-50 ${isVoted ? cfg.activeClass : cfg.bgClass}`}
                                        >
                                            <span className="text-xl">{cfg.icon}</span>
                                            <span>{opt.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {votedOptionText && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                    Respondeu: <span className="font-semibold text-slate-700 dark:text-slate-200">{votedOptionText}</span>
                                    {' '}· <button type="button" className="text-rose-500 hover:underline" onClick={async () => {
                                        setVoting(true);
                                        try {
                                            const res = await PollsApi.removeVote(groupId, poll.id);
                                            onUpdated(res.data.data);
                                            toast.success('Resposta removida.');
                                        } catch (e) {
                                            toast.error(extractApiError(e, 'Erro.'));
                                        } finally { setVoting(false); }
                                    }}>Remover</button>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Attendance breakdown */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Respostas</p>
                        {rsvpOptions.length === 0 && (
                            <div className="text-center py-6 text-slate-400">
                                <AlertCircle size={24} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Sem opções.</p>
                            </div>
                        )}
                        {rsvpOptions.map(opt => {
                            const cfg = RSVP_CONFIG[opt.text] ?? { icon: '•', colorClass: 'text-slate-700', bgClass: '', activeClass: '' };
                            const color = PROGRESS_COLORS[opt.text] ?? '#6366f1';
                            const votersForOpt = poll.votes?.filter(v => v.optionId === opt.id) ?? [];
                            const p = pct(opt.voteCount, totalVotes);
                            return (
                                <div key={opt.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 p-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{cfg.icon}</span>
                                            <span className={`text-sm font-semibold ${cfg.colorClass}`}>{opt.text}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{opt.voteCount} pessoa{opt.voteCount !== 1 ? 's' : ''}</span>
                                            <span className="text-xs font-semibold" style={{ color }}>{p}%</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: color }} />
                                    </div>
                                    {(poll.showVotes || isAdmin) && votersForOpt.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {votersForOpt.map(v => (
                                                <span key={v.playerId} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                                                    {v.playerName}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Gerenciar Respostas (admin) */}
                {isAdmin && poll.members && poll.members.length > 0 && (
                    <AdminVotePanel poll={poll} groupId={groupId} onUpdated={onUpdated} />
                )}

                {/* Footer (admin) */}
                {isAdmin && (
                    <div className="px-5 py-3 border-t dark:border-slate-700 bg-slate-50/80 dark:bg-slate-700/30 flex items-center gap-2 flex-wrap justify-end shrink-0">
                        {poll.status === 'open' ? (
                            <button
                                type="button"
                                onClick={() => setShowClosePollModal(true)}
                                disabled={!!actionLoading}
                                className="px-3 py-2 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                <Lock size={13} /> Encerrar
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleReopenPoll}
                                disabled={!!actionLoading}
                                className="px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                {actionLoading === 'reopen' ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                                Reabrir
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDeletePoll}
                            disabled={!!actionLoading}
                            className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 bg-rose-50 text-sm hover:bg-rose-100 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {actionLoading === 'delete' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            Excluir
                        </button>
                    </div>
                )}
                <div className="sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
            </div>
        </ModalBackdrop>
        {showClosePollModal && (
            <PollClosePollModal
                pollTitle={poll.title}
                saving={actionLoading === 'close'}
                onClose={() => setShowClosePollModal(false)}
                onConfirm={handleClosePoll}
            />
        )}
        </>
    );
}

export default PollEventDetailModal;
