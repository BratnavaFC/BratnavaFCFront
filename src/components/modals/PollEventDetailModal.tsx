import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Check, Lock, Unlock, Trash2,
    Users, Clock, DollarSign, CalendarDays,
    MapPin, AlertCircle, UserPlus, UserMinus, Pencil,
} from 'lucide-react';
import { PollsApi } from '../../api/endpoints';
import { useConfirm } from '../ConfirmDialog';
import { extractApiError } from '../../lib/apiError';
import ModalBackdrop from './ModalBackdrop';
import PollClosePollModal from './PollClosePollModal';
import { isDeadlinePassed, formatDeadline } from '../../utils/pollUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PollGuest {
    id: string;
    voterPlayerId: string;
    voterPlayerName: string;
    guestName: string;
    isAdult: boolean;
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
    guests: PollGuest[];
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
    allowGuests: boolean;
    isAcceptingVotes: boolean;
}

interface PollEventDetailModalProps {
    poll: Poll;
    groupId: string;
    isAdmin: boolean;
    myPlayerId?: string;
    onClose: () => void;
    onUpdated: (p: Poll) => void;
}

const EVENT_ICONS = ['🥩','🍺','🎂','🎉','⚽','🏆','🎵','🍔','🎯','🌟','🤝','🚀','📅','🎊'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(votes: number, total: number) {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
}

function optionPresenceCount(poll: Poll, option: PollOption, votes: PollVote[]) {
    const base = option.voteCount;
    if (poll.type !== 'event' || option.text.toLowerCase() !== 'sim') {
        return base;
    }
    return base + votes.reduce((sum, vote) => sum + (vote.guests?.length ?? 0), 0);
}

function optionPresenceNames(poll: Poll, option: PollOption, votes: PollVote[]) {
    const names = votes.map(v => v.playerName);
    if (poll.type !== 'event' || option.text.toLowerCase() !== 'sim') {
        return names;
    }
    return votes.flatMap(v => [
        v.playerName,
        ...((v.guests ?? []).map(g => `${g.guestName} (convidado de ${v.playerName})`)),
    ]);
}

function optionGuestCount(poll: Poll, option: PollOption, votes: PollVote[]) {
    if (poll.type !== 'event' || option.text.toLowerCase() !== 'sim') return 0;
    return votes.reduce((sum, vote) => sum + (vote.guests?.length ?? 0), 0);
}

function formatEventDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
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
            onUpdated(res.data.data as unknown as Poll);
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
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Users size={12} />
                    Gerenciar respostas
                    <span className="font-normal normal-case tracking-normal text-[11px]">
                        {votedCount}/{members.length} responderam
                        {notVotedCount > 0 && <span className="text-amber-500 dark:text-amber-400"> · {notVotedCount} pendente{notVotedCount > 1 ? 's' : ''}</span>}
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

// ─── GuestSection ─────────────────────────────────────────────────────────────

function GuestSection({
    poll, groupId, myVote, isAcceptingVotes, onUpdated,
}: {
    poll: Poll;
    groupId: string;
    myVote: PollVote | null;
    isAcceptingVotes: boolean;
    onUpdated: (p: Poll) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [isAdult, setIsAdult] = useState(true);
    const [saving, setSaving] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const myGuests = myVote?.guests ?? [];

    async function handleAdd() {
        if (!guestName.trim()) { toast.error('Nome do convidado é obrigatório.'); return; }
        setSaving(true);
        try {
            const res = await PollsApi.addGuest(groupId, poll.id, { guestName: guestName.trim(), isAdult });
            const added: PollGuest = res.data.data as PollGuest;
            const updatedVotes = (poll.votes ?? []).map(v =>
                v.playerId === myVote?.playerId
                    ? { ...v, guests: [...v.guests, added] }
                    : v
            );
            onUpdated({ ...poll, votes: updatedVotes });
            setGuestName('');
            setAdding(false);
            toast.success('Convidado adicionado!');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao adicionar convidado.'));
        } finally { setSaving(false); }
    }

    async function handleRemove(guestId: string) {
        setRemovingId(guestId);
        try {
            await PollsApi.removeGuest(groupId, poll.id, guestId);
            const updatedVotes = (poll.votes ?? []).map(v =>
                v.playerId === myVote?.playerId
                    ? { ...v, guests: v.guests.filter(g => g.id !== guestId) }
                    : v
            );
            onUpdated({ ...poll, votes: updatedVotes });
            toast.success('Convidado removido.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao remover convidado.'));
        } finally { setRemovingId(null); }
    }

    return (
        <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <UserPlus size={11} />
                    Meus convidados
                </p>
                {isAcceptingVotes ? (
                    <button
                        type="button"
                        onClick={() => setAdding(p => !p)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:opacity-75 transition-opacity"
                    >
                        + Adicionar
                    </button>
                ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Prazo encerrado</span>
                )}
            </div>

            {/* Add form */}
            {adding && (
                <div className="space-y-2 pt-1">
                    <input
                        autoFocus
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white dark:bg-slate-700 dark:text-white"
                        placeholder="Nome do convidado"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <div className="flex gap-2">
                        {(['Adulto', 'Criança'] as const).map(label => {
                            const selected = label === 'Adulto' ? isAdult : !isAdult;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setIsAdult(label === 'Adulto')}
                                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${selected ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={saving || !guestName.trim()}
                            className="flex-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Confirmar
                        </button>
                        <button type="button" onClick={() => { setAdding(false); setGuestName(''); }} className="px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* My guest list */}
            {myGuests.length === 0 && !adding ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhum convidado ainda.</p>
            ) : myGuests.map(g => (
                <div key={g.id} className="flex items-center gap-2 group">
                    <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[9px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {g.guestName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">
                        {g.guestName}
                        <span className="ml-1.5 text-slate-400 dark:text-slate-500">{g.isAdult ? 'Adulto' : 'Criança'}</span>
                    </span>
                    {isAcceptingVotes && (
                        <button
                            type="button"
                            onClick={() => handleRemove(g.id)}
                            disabled={removingId === g.id}
                            className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-rose-400 dark:hover:text-rose-400 transition-all disabled:opacity-40"
                        >
                            {removingId === g.id ? <Loader2 size={10} className="animate-spin" /> : <UserMinus size={10} />}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── PresencasTab ─────────────────────────────────────────────────────────────

function PresencasTab({ poll, isAdmin }: { poll: Poll; isAdmin: boolean }) {
    const simOption = poll.options.find(o => o.text.toLowerCase() === 'sim');
    const goingVotes = (poll.votes ?? []).filter(v => v.optionId === (simOption?.id ?? ''));

    if (!poll.showVotes && !isAdmin) {
        return (
            <div className="text-center py-6 text-slate-400">
                <Users size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">As presenças não estão visíveis.</p>
            </div>
        );
    }

    if (goingVotes.length === 0) {
        return (
            <div className="text-center py-6 text-slate-400">
                <Users size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma presença confirmada ainda.</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {goingVotes.map(v => (
                <div key={v.playerId} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                            {v.playerName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{v.playerName}</span>
                        {v.guests.length > 0 && (
                            <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">+{v.guests.length} convidado{v.guests.length > 1 ? 's' : ''}</span>
                        )}
                    </div>
                    {v.guests.length > 0 && (
                        <div className="mt-1.5 space-y-1 pl-8">
                            {v.guests.map(g => (
                                <p key={g.id} className="text-xs text-slate-500 dark:text-slate-400">
                                    {g.guestName}
                                    <span className="ml-1 text-slate-400 dark:text-slate-500">(Convidado de {v.playerName} · {g.isAdult ? 'Adulto' : 'Criança'})</span>
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── PollEventDetailModal ─────────────────────────────────────────────────────

function PollEventDetailModal({
    poll, groupId, isAdmin, myPlayerId, onClose, onUpdated,
}: PollEventDetailModalProps) {
    poll = {
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : [],
        myVotedOptionIds: Array.isArray(poll.myVotedOptionIds) ? poll.myVotedOptionIds : [],
        votes: Array.isArray(poll.votes) ? poll.votes : (poll.votes ?? null),
        members: Array.isArray(poll.members) ? poll.members : (poll.members ?? null),
    };
    const [voting, setVoting] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showClosePollModal, setShowClosePollModal] = useState(false);
    const [showDeadlineEdit, setShowDeadlineEdit] = useState(false);
    const [deadlineDateDraft, setDeadlineDateDraft] = useState(poll.deadlineDate ?? '');
    const [deadlineTimeDraft, setDeadlineTimeDraft] = useState(poll.deadlineTime ?? '');
    const [showDetailsEdit, setShowDetailsEdit] = useState(false);
    const [titleDraft, setTitleDraft] = useState(poll.title ?? '');
    const [eventLocationDraft, setEventLocationDraft] = useState(poll.eventLocation ?? '');
    const [eventIconDraft, setEventIconDraft] = useState(poll.eventIcon ?? '');
    const [descriptionDraft, setDescriptionDraft] = useState(poll.description ?? '');
    const [costTypeDraft, setCostTypeDraft] = useState(poll.costType ?? '');
    const [costAmountDraft, setCostAmountDraft] = useState(poll.costAmount != null ? String(poll.costAmount) : '');
    const [activeTab, setActiveTab] = useState<'respostas' | 'presencas'>('respostas');

    const isEvent = poll.type === 'event';
    const deadlinePassed = isDeadlinePassed(poll.deadlineDate, poll.deadlineTime);
    const isOpen = poll.status === 'open' && !deadlinePassed;
    const cost = formatCost(poll.costType, poll.costAmount);

    const rsvpOptions = [...poll.options].sort((a, b) => a.sortOrder - b.sortOrder);
    const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
    const votedOptionText = getRsvpOption(poll.options, poll.myVotedOptionIds);
    const votedOptionId = poll.myVotedOptionIds[0] ?? null;

    // Find the "Sim" (going) option
    const simOption = poll.options.find(o => o.text.toLowerCase() === 'sim');
    const simVotes = simOption ? (poll.votes ?? []).filter(v => v.optionId === simOption.id) : [];
    const eventPresenceTotal = simOption ? optionPresenceCount(poll, simOption, simVotes) : 0;
    const iVotedSim = simOption ? poll.myVotedOptionIds.includes(simOption.id) : false;
    const myVote = myPlayerId ? (poll.votes ?? []).find(v => v.playerId === myPlayerId) ?? null : null;

    const RSVP_CONFIG: Record<string, { icon: string; colorClass: string; bgClass: string; activeClass: string }> = {
        'Sim':    { icon: '✓', colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-200', activeClass: 'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-600 dark:border-emerald-600' },
        'Talvez': { icon: '~', colorClass: 'text-amber-700 dark:text-amber-400',   bgClass: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-700 dark:text-slate-200',   activeClass: 'bg-amber-500 border-amber-500 text-white dark:bg-amber-500 dark:border-amber-500' },
        'Não':    { icon: '✕', colorClass: 'text-rose-700 dark:text-rose-400',    bgClass: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-200',    activeClass: 'bg-rose-600 border-rose-600 text-white dark:bg-rose-600 dark:border-rose-600' },
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
                onUpdated(res.data.data as unknown as Poll);
                toast.success('Resposta removida.');
            } else {
                const res = await PollsApi.castVote(groupId, poll.id, { optionIds: [optionId] });
                onUpdated(res.data.data as unknown as Poll);
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

    async function handleUpdateDetails() {
        if (!titleDraft.trim()) {
            toast.error('Informe o nome.');
            return;
        }
        setActionLoading('details');
        try {
            const costAmt = costAmountDraft.trim() !== '' ? parseFloat(costAmountDraft) : null;
            const res = await PollsApi.updatePollDetails(groupId, poll.id, {
                title:       titleDraft.trim(),
                description: descriptionDraft.trim() !== '' ? descriptionDraft.trim() : '',
                eventLocation: isEvent ? eventLocationDraft.trim() : undefined,
                eventIcon:   isEvent ? eventIconDraft.trim() : undefined,
                costAmount:  costAmt,
                costType:    costTypeDraft || '',
            });
            onUpdated({ ...poll, ...(res.data.data as Partial<Poll>), options: poll.options });
            setShowDetailsEdit(false);
            toast.success('Evento atualizado.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao atualizar.'));
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

    async function handleUpdateDeadline(clear = false) {
        setActionLoading('deadline');
        try {
            await PollsApi.updateDeadline(groupId, poll.id, {
                deadlineDate:  clear ? null : (deadlineDateDraft || null),
                deadlineTime:  clear ? null : (deadlineTimeDraft || null),
                clearDeadline: clear,
            });
            onUpdated({
                ...poll,
                status:       poll.status === 'closed' ? 'open' : poll.status,
                deadlineDate: clear ? null : (deadlineDateDraft || null),
                deadlineTime: clear ? null : (deadlineTimeDraft || null),
            });
            setShowDeadlineEdit(false);
            toast.success(clear ? 'Prazo removido.' : 'Prazo atualizado!');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao atualizar prazo.'));
        } finally { setActionLoading(null); }
    }

    const { confirm, confirmDialog } = useConfirm();

    async function handleDeletePoll() {
        if (!(await confirm({ title: 'Excluir evento', message: `Excluir o evento "${poll.title}"?`, confirmLabel: 'Excluir', danger: true }))) return;
        setActionLoading('delete');
        try {
            await PollsApi.deletePoll(groupId, poll.id);
            onClose();
            toast.success('Evento excluído.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    async function handleToggleAllowGuests() {
        setActionLoading('allowGuests');
        const next = !poll.allowGuests;
        try {
            await PollsApi.setAllowGuests(groupId, poll.id, next);
            onUpdated({ ...poll, allowGuests: next });
            toast.success(next ? 'Convidados habilitados.' : 'Convidados desabilitados.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao alterar permissão de convidados.'));
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
                                    {poll.allowGuests && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800 flex items-center gap-1">
                                            <Users size={9} /> Convidados
                                        </span>
                                    )}
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
                            {isEvent
                                ? `${poll.totalVoters} voto${poll.totalVoters !== 1 ? 's' : ''} · ${eventPresenceTotal} presença${eventPresenceTotal !== 1 ? 's' : ''}`
                                : `${poll.totalVoters} resposta${poll.totalVoters !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* RSVP buttons */}
                    {isOpen && (
                        <div className="space-y-2.5">
                            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sua resposta</p>
                            <div className="flex gap-2">
                                {rsvpOptions.map(opt => {
                                    const cfg = RSVP_CONFIG[opt.text] ?? { icon: '·', colorClass: 'text-slate-700 dark:text-slate-300', bgClass: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-slate-300 text-slate-700 dark:text-slate-200', activeClass: 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900' };
                                    const isVoted = votedOptionId === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            disabled={voting}
                                            onClick={() => handleRsvp(opt.id)}
                                            className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${isVoted ? cfg.activeClass : cfg.bgClass}`}
                                        >
                                            <span className="text-base leading-none">{cfg.icon}</span>
                                            <span>{opt.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {votedOptionText && (
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    Resposta atual: <span className="font-medium text-slate-600 dark:text-slate-300">{votedOptionText}</span>
                                    {' '}·{' '}<button type="button" className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 underline underline-offset-2 transition-colors" onClick={async () => {
                                        setVoting(true);
                                        try {
                                            const res = await PollsApi.removeVote(groupId, poll.id);
                                            onUpdated(res.data.data as unknown as Poll);
                                            toast.success('Resposta removida.');
                                        } catch (e) {
                                            toast.error(extractApiError(e, 'Erro.'));
                                        } finally { setVoting(false); }
                                    }}>remover</button>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Guest section — only when user voted "Sim" and allowGuests is on */}
                    {poll.allowGuests && iVotedSim && (
                        <GuestSection
                            poll={poll}
                            groupId={groupId}
                            myVote={myVote}
                            isAcceptingVotes={poll.isAcceptingVotes}
                            onUpdated={onUpdated}
                        />
                    )}

                    {/* Tab switcher */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700/60">
                        {(['respostas', 'presencas'] as const).map(tab => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`px-1 pb-2 mr-5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                                    activeTab === tab
                                        ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                                        : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                {tab === 'respostas' ? `Respostas (${totalVotes})` : 'Presenças'}
                            </button>
                        ))}
                    </div>

                    {/* Tab: Respostas */}
                    {activeTab === 'respostas' && (
                        <div className="space-y-1.5">
                            {rsvpOptions.length === 0 && (
                                <div className="text-center py-6 text-slate-400">
                                    <AlertCircle size={20} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Sem opções.</p>
                                </div>
                            )}
                            {rsvpOptions.map(opt => {
                                const cfg = RSVP_CONFIG[opt.text] ?? { icon: '·', colorClass: 'text-slate-600 dark:text-slate-300', bgClass: '', activeClass: '' };
                                const color = PROGRESS_COLORS[opt.text] ?? '#6366f1';
                                const votersForOpt = poll.votes?.filter(v => v.optionId === opt.id) ?? [];
                                const voterNames = votersForOpt.map(v => v.playerName);
                                const p = pct(opt.voteCount, totalVotes);
                                const countLabel = `${opt.voteCount} voto${opt.voteCount !== 1 ? 's' : ''}`;
                                return (
                                    <div key={opt.id} className="py-2.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-semibold ${cfg.colorClass}`}>{opt.text}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                                    {countLabel}
                                                </span>
                                                <span className="text-xs font-semibold tabular-nums" style={{ color }}>{p}%</span>
                                            </div>
                                        </div>
                                        <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: color }} />
                                        </div>
                                        {(poll.showVotes || isAdmin) && votersForOpt.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {voterNames.map((name, index) => (
                                                    <span key={`${opt.id}-${index}-${name}`} className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Tab: Presenças */}
                    {activeTab === 'presencas' && (
                        <PresencasTab poll={poll} isAdmin={isAdmin} />
                    )}
                </div>

                {/* Gerenciar respostas (admin) */}
                {isAdmin && poll.members && poll.members.length > 0 && (
                    <AdminVotePanel poll={poll} groupId={groupId} onUpdated={onUpdated} />
                )}

                {/* Inline deadline editor (admin) */}
                {isAdmin && showDeadlineEdit && (
                    <div className="px-5 py-3 border-t dark:border-slate-700 bg-amber-50/60 dark:bg-amber-900/10 space-y-2.5 shrink-0">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <CalendarDays size={12} /> Alterar prazo de resposta
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <div>
                                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Data</label>
                                <input
                                    type="date"
                                    value={deadlineDateDraft}
                                    onChange={e => setDeadlineDateDraft(e.target.value)}
                                    className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Horário <span className="text-slate-400">(opcional)</span></label>
                                <input
                                    type="time"
                                    value={deadlineTimeDraft}
                                    onChange={e => setDeadlineTimeDraft(e.target.value)}
                                    className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => handleUpdateDeadline(false)}
                                disabled={!!actionLoading || !deadlineDateDraft}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading === 'deadline' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Salvar
                            </button>
                            {poll.deadlineDate && (
                                <button
                                    type="button"
                                    onClick={() => handleUpdateDeadline(true)}
                                    disabled={!!actionLoading}
                                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50"
                                >
                                    Remover prazo
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowDeadlineEdit(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Inline details editor (admin) */}
                {isAdmin && showDetailsEdit && (
                    <div className="px-5 py-3 border-t dark:border-slate-700 bg-indigo-50/60 dark:bg-indigo-900/10 space-y-3 shrink-0 max-h-[52vh] overflow-y-auto">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                            <Pencil size={12} /> Editar evento
                        </p>
                        <div>
                            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Nome</label>
                            <input
                                value={titleDraft}
                                onChange={e => setTitleDraft(e.target.value)}
                                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 dark:text-white"
                            />
                        </div>
                        {isEvent && (
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Local</label>
                                    <input
                                        value={eventLocationDraft}
                                        onChange={e => setEventLocationDraft(e.target.value)}
                                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Ícone</label>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {EVENT_ICONS.map(icon => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => setEventIconDraft(icon)}
                                                className={`h-8 rounded-lg text-lg flex items-center justify-center transition-colors border ${eventIconDraft === icon ? 'border-slate-900 bg-white dark:border-white dark:bg-white/10' : 'border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700'}`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Descrição</label>
                            <textarea
                                rows={2}
                                value={descriptionDraft}
                                onChange={e => setDescriptionDraft(e.target.value)}
                                placeholder="Descrição opcional…"
                                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 dark:text-white"
                            />
                        </div>
                        <div className="sticky bottom-0 -mx-5 px-5 pt-2 pb-1 border-t border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/95 dark:bg-slate-800/95 flex gap-2 flex-wrap">
                            <div>
                                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Custo</label>
                                <select
                                    value={costTypeDraft}
                                    onChange={e => setCostTypeDraft(e.target.value)}
                                    className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 dark:text-white"
                                >
                                    <option value="">Sem custo</option>
                                    <option value="individual">Individual</option>
                                    <option value="group">Grupo</option>
                                </select>
                            </div>
                            {costTypeDraft && (
                                <div>
                                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Valor (R$)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={costAmountDraft}
                                        onChange={e => setCostAmountDraft(e.target.value)}
                                        placeholder="0,00"
                                        className="w-24 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleUpdateDetails}
                                disabled={!!actionLoading}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading === 'details' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Salvar
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDetailsEdit(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer (admin) */}
                {isAdmin && (
                    <div className="px-5 py-3 border-t dark:border-slate-700 bg-slate-50/80 dark:bg-slate-700/30 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:justify-end shrink-0">
                        {/* Allow guests toggle */}
                        <button
                            type="button"
                            onClick={handleToggleAllowGuests}
                            disabled={!!actionLoading}
                            className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                                poll.allowGuests
                                    ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                            }`}
                        >
                            {actionLoading === 'allowGuests' ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                            {poll.allowGuests ? 'Convidados: ativo' : 'Permitir convidados'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowDetailsEdit(p => !p);
                                setTitleDraft(poll.title ?? '');
                                setEventLocationDraft(poll.eventLocation ?? '');
                                setEventIconDraft(poll.eventIcon ?? '📅');
                                setDescriptionDraft(poll.description ?? '');
                                setCostTypeDraft(poll.costType ?? '');
                                setCostAmountDraft(poll.costAmount != null ? String(poll.costAmount) : '');
                            }}
                            disabled={!!actionLoading}
                            title="Editar evento"
                            className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 ${showDetailsEdit ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                        >
                            <Pencil size={13} />
                            Editar
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowDeadlineEdit(p => !p); setDeadlineDateDraft(poll.deadlineDate ?? ''); setDeadlineTimeDraft(poll.deadlineTime ?? ''); }}
                            disabled={!!actionLoading}
                            title="Alterar prazo de resposta"
                            className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 ${showDeadlineEdit ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                        >
                            <CalendarDays size={13} />
                            Prazo
                        </button>
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
        {confirmDialog}
        </>
    );
}

export default PollEventDetailModal;
