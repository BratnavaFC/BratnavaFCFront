import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Check, Lock, Unlock, Trash2,
    Plus, Pencil, Eye, EyeOff,
    Users, Clock, Image,
    CheckSquare, Square, BarChart2, AlertCircle,
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

interface OptionDraft {
    text: string;
    description: string;
    imageUrl: string;
    _dragOver: boolean;
}

interface PollDetailModalProps {
    poll: Poll;
    groupId: string;
    isAdmin: boolean;
    onClose: () => void;
    onUpdated: (p: Poll) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_OPTION_DRAFT: OptionDraft = {
    text: '', description: '', imageUrl: '', _dragOver: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(votes: number, total: number) {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
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

// ─── OptionDraftForm ──────────────────────────────────────────────────────────

function OptionDraftForm({
    draft, onChange, onSave, onCancel, saving, isEdit,
}: {
    draft: OptionDraft;
    onChange: (d: OptionDraft) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    isEdit: boolean;
}) {
    const set = (key: keyof OptionDraft, val: any) => onChange({ ...draft, [key]: val });

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 p-4 shadow-sm space-y-3">
            {/* Texto */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Texto da opção *</label>
                <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="Ex: Churrasco no domingo"
                    value={draft.text}
                    onChange={e => set('text', e.target.value)}
                />
            </div>

            {/* Descrição */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Descrição <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    rows={2}
                    placeholder="Detalhes sobre esta opção..."
                    value={draft.description}
                    onChange={e => set('description', e.target.value)}
                />
            </div>

            {/* Upload de imagem */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    <Image size={11} className="inline mr-1" />
                    Foto <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                </label>
                <label
                    className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-full rounded-lg border-2 border-dashed px-3 py-4 text-sm transition-colors
                        ${draft._dragOver
                            ? 'border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    onDragOver={e => { e.preventDefault(); set('_dragOver', true); }}
                    onDragLeave={() => set('_dragOver', false)}
                    onDrop={e => {
                        e.preventDefault();
                        set('_dragOver', false);
                        const file = e.dataTransfer.files?.[0];
                        if (!file || !file.type.startsWith('image/')) return;
                        if (file.size > 5 * 1024 * 1024) { toast.error('Foto muito grande. Máximo 5 MB.'); return; }
                        const reader = new FileReader();
                        reader.onload = ev => set('imageUrl', ev.target?.result as string);
                        reader.readAsDataURL(file);
                    }}
                >
                    <Image size={18} />
                    <span>{draft.imageUrl ? 'Trocar foto' : 'Arraste ou clique para escolher'}</span>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) { toast.error('Foto muito grande. Máximo 5 MB.'); return; }
                            const reader = new FileReader();
                            reader.onload = ev => set('imageUrl', ev.target?.result as string);
                            reader.readAsDataURL(file);
                        }}
                    />
                </label>
                {draft.imageUrl && (
                    <div className="mt-2 relative">
                        <img
                            src={draft.imageUrl}
                            alt="Preview"
                            className="h-32 w-full object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                        />
                        <button
                            type="button"
                            onClick={() => set('imageUrl', '')}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !draft.text.trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
                >
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {isEdit ? 'Salvar' : 'Adicionar'}
                </button>
            </div>
        </div>
    );
}

// ─── PollResultsView ─────────────────────────────────────────────────────────

function PollResultsView({ poll, totalVotes, COLORS }: {
    poll: Poll;
    totalVotes: number;
    COLORS: string[];
}) {
    const sorted = [...poll.options].sort((a, b) => b.voteCount - a.voteCount);
    const maxVotes = sorted[0]?.voteCount ?? 0;
    const votedPlayerIds = new Set((poll.votes ?? []).map(v => v.playerId));
    const notVoted = (poll.members ?? []).filter(m => !votedPlayerIds.has(m.playerId));
    const votedCount = votedPlayerIds.size;
    const memberCount = (poll.members ?? []).length;

    return (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {/* Summary */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span className="flex items-center gap-1.5">
                    <Users size={12} />
                    {votedCount} de {memberCount} responderam
                    {notVoted.length > 0 && (
                        <span className="text-amber-500 font-semibold">· {notVoted.length} pendente{notVoted.length > 1 ? 's' : ''}</span>
                    )}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{totalVotes} voto{totalVotes !== 1 ? 's' : ''}</span>
            </div>

            {sorted.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                    <BarChart2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma opção cadastrada.</p>
                </div>
            )}

            {sorted.map((opt, rank) => {
                const origIdx = poll.options.findIndex(o => o.id === opt.id);
                const color = COLORS[origIdx % COLORS.length];
                const p = pct(opt.voteCount, totalVotes);
                const isLeader = opt.voteCount > 0 && opt.voteCount === maxVotes;
                const voters = (poll.votes ?? []).filter(v => v.optionId === opt.id);

                return (
                    <div
                        key={opt.id}
                        className={`rounded-2xl border-2 p-3.5 transition-all ${
                            isLeader ? 'border-slate-900/20 dark:border-white/20 bg-slate-50/80 dark:bg-slate-700/50 shadow-sm' : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                    >
                        {/* Top row */}
                        <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="shrink-0 w-6 text-center">
                                {isLeader
                                    ? <span className="text-lg leading-none">🏆</span>
                                    : <span className="text-xs font-bold text-slate-400">#{rank + 1}</span>
                                }
                            </div>
                            {opt.imageUrl && (
                                <img
                                    src={opt.imageUrl}
                                    alt={opt.text}
                                    className="h-9 w-9 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-600"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold leading-snug ${isLeader ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {opt.text}
                                </p>
                                {opt.description && (
                                    <p className="text-xs text-slate-400 truncate">{opt.description}</p>
                                )}
                            </div>
                            <div className="text-right shrink-0 pl-1">
                                <p className="text-xl font-black leading-none" style={{ color }}>{p}%</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    {opt.voteCount} voto{opt.voteCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${p}%`, backgroundColor: color }}
                            />
                        </div>

                        {/* Voter chips */}
                        {voters.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1">
                                {voters.map(v => (
                                    <span
                                        key={v.playerId}
                                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: `${color}20`, color }}
                                    >
                                        {v.playerName}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Non-voters */}
            {notVoted.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
                    <p className="text-[11px] font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                        <Clock size={11} /> Sem resposta ({notVoted.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {notVoted.map(m => (
                            <span key={m.playerId} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                {m.playerName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── VoteBar ─────────────────────────────────────────────────────────────────

function VoteBar({ count, total, color }: { count: number; total: number; color: string }) {
    const p = pct(count, total);
    return (
        <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500 dark:text-slate-400">{count} voto{count !== 1 ? 's' : ''}</span>
                <span className="font-semibold" style={{ color }}>{p}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${p}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

// ─── PollDetailModal ──────────────────────────────────────────────────────────

function PollDetailModal({
    poll, groupId, isAdmin, onClose, onUpdated,
}: PollDetailModalProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>(poll.myVotedOptionIds);
    const [voting, setVoting] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [addingOption, setAddingOption] = useState(false);
    const [editingOption, setEditingOption] = useState<string | null>(null);
    const [optionDraft, setOptionDraft] = useState<OptionDraft>(EMPTY_OPTION_DRAFT);
    const [savingOption, setSavingOption] = useState(false);
    const [showClosePollModal, setShowClosePollModal] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'options' | 'resultado'>('options');

    const deadlinePassed = isDeadlinePassed(poll.deadlineDate, poll.deadlineTime);
    const isOpen = poll.status === 'open' && !deadlinePassed;
    const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
    const hasMyVotes = selectedIds.length > 0;
    const votesChanged = JSON.stringify([...selectedIds].sort()) !== JSON.stringify([...poll.myVotedOptionIds].sort());

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

    function toggleOption(id: string) {
        if (!isOpen) return;
        if (poll.allowMultipleVotes) {
            setSelectedIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            );
        } else {
            setSelectedIds(prev => prev.includes(id) ? [] : [id]);
        }
    }

    async function submitVote() {
        if (selectedIds.length === 0) {
            await handleRemoveVote();
            return;
        }
        setVoting(true);
        try {
            const res = await PollsApi.castVote(groupId, poll.id, { optionIds: selectedIds });
            onUpdated(res.data.data);
            toast.success('Voto registrado!');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao votar.'));
        } finally { setVoting(false); }
    }

    async function handleRemoveVote() {
        setVoting(true);
        try {
            const res = await PollsApi.removeVote(groupId, poll.id);
            onUpdated(res.data.data);
            setSelectedIds([]);
            toast.success('Voto removido.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao remover voto.'));
        } finally { setVoting(false); }
    }

    async function handleReopenPoll() {
        setActionLoading('reopen');
        try {
            await PollsApi.reopenPoll(groupId, poll.id);
            onClose();
            toast.success('Votação reaberta.');
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
            toast.success('Votação encerrada.' + (dto.createEvent ? ' Evento criado no calendário!' : ''));
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    async function handleDeletePoll() {
        if (!confirm(`Excluir a votação "${poll.title}"?`)) return;
        setActionLoading('delete');
        try {
            await PollsApi.deletePoll(groupId, poll.id);
            onClose();
            toast.success('Votação excluída.');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    async function handleDeleteOption(optionId: string) {
        if (!confirm('Excluir esta opção?')) return;
        setActionLoading(`del-opt-${optionId}`);
        try {
            await PollsApi.deleteOption(groupId, poll.id, optionId);
            toast.success('Opção excluída.');
            const res = await PollsApi.getPoll(groupId, poll.id);
            onUpdated(res.data.data);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro.'));
        } finally { setActionLoading(null); }
    }

    function startEditOption(opt: PollOption) {
        setEditingOption(opt.id);
        setOptionDraft({ text: opt.text, description: opt.description ?? '', imageUrl: opt.imageUrl ?? '', _dragOver: false });
        setAddingOption(false);
    }

    async function saveOptionDraft(isEdit: boolean, optionId?: string) {
        if (!optionDraft.text.trim()) { toast.error('Texto é obrigatório.'); return; }
        setSavingOption(true);
        try {
            const dto = {
                text: optionDraft.text,
                description: optionDraft.description || null,
                imageUrl: optionDraft.imageUrl || null,
            };
            if (isEdit && optionId) {
                await PollsApi.updateOption(groupId, poll.id, optionId, dto);
                toast.success('Opção atualizada!');
            } else {
                await PollsApi.addOption(groupId, poll.id, dto);
                toast.success('Opção adicionada!');
            }
            setAddingOption(false);
            setEditingOption(null);
            setOptionDraft(EMPTY_OPTION_DRAFT);
            const res = await PollsApi.getPoll(groupId, poll.id);
            onUpdated(res.data.data);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao salvar opção.'));
        } finally { setSavingOption(false); }
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
                <div className="px-5 py-4 border-b dark:border-slate-700 flex items-start justify-between gap-3 shrink-0">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                                {isOpen ? 'Aberta' : 'Encerrada'}
                            </span>
                            {poll.allowMultipleVotes && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                                    Múltipla escolha
                                </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1">
                                {poll.showVotes ? <Eye size={9} /> : <EyeOff size={9} />}
                                {poll.showVotes ? 'Votos visíveis' : 'Votos anônimos'}
                            </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{poll.title}</h2>
                        {poll.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{poll.description}</p>}
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1"><Users size={11} /> {poll.totalVoters} votante{poll.totalVoters !== 1 ? 's' : ''}</span>
                            {poll.deadlineDate && (
                                <span className={`flex items-center gap-1 font-medium ${deadlinePassed ? 'text-rose-500' : 'text-amber-600'}`}>
                                    <Clock size={11} />
                                    {deadlinePassed ? 'Prazo encerrado' : `Prazo: ${formatDeadline(poll.deadlineDate, poll.deadlineTime)}`}
                                </span>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                        <X size={16} />
                    </button>
                </div>

                {/* Admin tab switcher */}
                {isAdmin && (
                    <div className="flex border-b dark:border-slate-700 shrink-0">
                        <button
                            type="button"
                            onClick={() => setDetailTab('options')}
                            className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                                detailTab === 'options'
                                    ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white'
                                    : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                            <CheckSquare size={12} /> Opções
                        </button>
                        <button
                            type="button"
                            onClick={() => setDetailTab('resultado')}
                            className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                                detailTab === 'resultado'
                                    ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white'
                                    : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                            <BarChart2 size={12} /> Resultado
                        </button>
                    </div>
                )}

                {/* Results view */}
                {isAdmin && detailTab === 'resultado' && (
                    <PollResultsView poll={poll} totalVotes={totalVotes} COLORS={COLORS} />
                )}

                {/* Scrollable body */}
                <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-4${isAdmin && detailTab !== 'options' ? ' hidden' : ''}`}>

                    {/* Options */}
                    {poll.options.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                            <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Nenhuma opção cadastrada ainda.</p>
                        </div>
                    )}

                    {poll.options.map((opt, i) => {
                        const color = COLORS[i % COLORS.length];
                        const isSelected = selectedIds.includes(opt.id);
                        const isEditing = editingOption === opt.id;
                        const votersForOpt = poll.votes?.filter(v => v.optionId === opt.id) ?? [];

                        if (isEditing) {
                            return (
                                <OptionDraftForm
                                    key={opt.id}
                                    draft={optionDraft}
                                    onChange={setOptionDraft}
                                    onSave={() => saveOptionDraft(true, opt.id)}
                                    onCancel={() => { setEditingOption(null); setOptionDraft(EMPTY_OPTION_DRAFT); }}
                                    saving={savingOption}
                                    isEdit
                                />
                            );
                        }

                        return (
                            <div
                                key={opt.id}
                                className={[
                                    'rounded-2xl border-2 overflow-hidden transition-all shadow-sm',
                                    isOpen ? 'cursor-pointer hover:shadow-md hover:border-slate-400 dark:hover:border-slate-500' : '',
                                    isSelected
                                        ? 'border-slate-900 dark:border-white bg-slate-900/5 dark:bg-white/5 shadow-md'
                                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800',
                                ].join(' ')}
                                onClick={() => isOpen && toggleOption(opt.id)}
                            >
                                {/* Banner de imagem (largura total) */}
                                {opt.imageUrl && (
                                    <div
                                        className="relative w-full bg-slate-100 overflow-hidden"
                                        style={{ aspectRatio: '16/9' }}
                                        onClick={e => { e.stopPropagation(); setLightboxSrc(opt.imageUrl!); }}
                                        title="Clique para ampliar"
                                    >
                                        <img
                                            src={opt.imageUrl}
                                            alt={opt.text}
                                            className="w-full h-full object-cover"
                                            onError={e => (e.currentTarget.parentElement!.style.display = 'none')}
                                        />
                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                            <div className="bg-white/90 rounded-full p-2 shadow-lg">
                                                <Image size={18} className="text-slate-700" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Conteúdo */}
                                <div className="p-3">
                                    <div className="flex items-start gap-3">
                                        {/* Indicador de seleção */}
                                        {isOpen && (
                                            <div className={[
                                                'h-5 w-5 rounded shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors',
                                                poll.allowMultipleVotes ? 'rounded-md' : 'rounded-full',
                                                isSelected ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-500',
                                            ].join(' ')}>
                                                {isSelected && <Check size={11} className="text-white dark:text-slate-900" strokeWidth={3} />}
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{opt.text}</p>
                                                    {opt.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</p>}
                                                </div>

                                                {/* Admin actions */}
                                                {isAdmin && (
                                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            title="Editar"
                                                            onClick={() => startEditOption(opt)}
                                                            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Excluir"
                                                            disabled={!!actionLoading}
                                                            onClick={() => handleDeleteOption(opt.id)}
                                                            className="h-7 w-7 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                                        >
                                                            {actionLoading === `del-opt-${opt.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Vote bar */}
                                            <VoteBar count={opt.voteCount} total={totalVotes} color={color} />

                                            {/* Who voted */}
                                            {(poll.showVotes || isAdmin) && votersForOpt.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {votersForOpt.map(v => (
                                                        <span key={v.playerId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                            {v.playerName}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add option form */}
                    {addingOption && (
                        <OptionDraftForm
                            draft={optionDraft}
                            onChange={setOptionDraft}
                            onSave={() => saveOptionDraft(false)}
                            onCancel={() => { setAddingOption(false); setOptionDraft(EMPTY_OPTION_DRAFT); }}
                            saving={savingOption}
                            isEdit={false}
                        />
                    )}

                    {/* Admin: add option button */}
                    {isAdmin && !addingOption && !editingOption && (
                        <button
                            type="button"
                            onClick={() => { setAddingOption(true); setOptionDraft(EMPTY_OPTION_DRAFT); }}
                            className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 py-3 text-sm text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={15} /> Adicionar opção
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t dark:border-slate-700 bg-slate-50/80 dark:bg-slate-700/30 flex items-center gap-2 flex-wrap shrink-0">
                    {/* Vote button (members) */}
                    {isOpen && (
                        <>
                            {votesChanged && (
                                <button
                                    type="button"
                                    onClick={submitVote}
                                    disabled={voting}
                                    className="flex-1 rounded-xl bg-slate-900 text-white text-sm font-semibold py-2.5 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {voting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {selectedIds.length === 0 ? 'Remover meu voto' : 'Confirmar voto'}
                                </button>
                            )}
                            {!votesChanged && hasMyVotes && (
                                <button
                                    type="button"
                                    onClick={handleRemoveVote}
                                    disabled={voting}
                                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm hover:bg-rose-50 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <X size={13} /> Remover voto
                                </button>
                            )}
                        </>
                    )}

                    {/* Admin controls */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 ml-auto">
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
                </div>

                {/* Gerenciar Respostas (admin) */}
                {isAdmin && poll.members && poll.members.length > 0 && (
                    <AdminVotePanel poll={poll} groupId={groupId} onUpdated={onUpdated} />
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

        {/* Lightbox */}
        {lightboxSrc && (
            <div
                className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                onClick={() => setLightboxSrc(null)}
            >
                <button
                    type="button"
                    className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    onClick={() => setLightboxSrc(null)}
                >
                    <X size={20} />
                </button>
                <img
                    src={lightboxSrc}
                    alt="Imagem ampliada"
                    className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
                    onClick={e => e.stopPropagation()}
                />
            </div>
        )}
    </>
    );
}

export default PollDetailModal;
