import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Check, Eye, EyeOff, Clock, DollarSign, MapPin,
} from 'lucide-react';
import { PollsApi } from '../../api/endpoints';
import { extractApiError } from '../../lib/apiError';
import ModalBackdrop from './ModalBackdrop';

// ─── Types ────────────────────────────────────────────────────────────────────

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
    members?: PollMemberVote[] | null;
}

interface PollCreateEventModalProps {
    groupId: string;
    onClose: () => void;
    onCreate: (poll: Poll) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_ICONS_CLOSE = ['🥩','🍺','🎂','🎉','⚽','🏆','🎵','🍔','🎯','🌟','🤝','🚀','📅','🎊'];

// ─── PollCreateEventModal ─────────────────────────────────────────────────────

function PollCreateEventModal({
    groupId, onClose, onCreate,
}: PollCreateEventModalProps) {
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventLocation, setEventLocation] = useState('');
    const [eventIcon, setEventIcon] = useState('📅');
    const [costType, setCostType] = useState('');
    const [costAmount, setCostAmount] = useState('');
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [showVotes, setShowVotes] = useState(true);

    async function handleCreate() {
        if (!title.trim()) { toast.error('Título é obrigatório.'); return; }
        if (!eventDate) { toast.error('Data do evento é obrigatória.'); return; }
        setSaving(true);
        try {
            const dto = {
                title: title.trim(),
                description: description.trim() || null,
                eventDate,
                eventTime: eventTime || null,
                eventLocation: eventLocation.trim() || null,
                eventIcon: eventIcon || null,
                costType: costType || null,
                costAmount: costAmount ? parseFloat(costAmount) : null,
                deadlineDate: deadlineDate || null,
                deadlineTime: deadlineTime || null,
                showVotes,
            };
            const res = await PollsApi.createEventPoll(groupId, dto);
            onCreate(res.data.data);
            onClose();
            toast.success('Evento criado!');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao criar evento.'));
        } finally { setSaving(false); }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 flex flex-col overflow-hidden">
                <div className="sm:hidden flex justify-center pt-2">
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>
                <div className="px-5 py-4 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xl">
                            {eventIcon || '📅'}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Novo evento</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Crie um evento com confirmação de presença</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Título *</label>
                        <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            placeholder="Ex: Churrasco de confraternização"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Descrição <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                        <textarea
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            rows={2}
                            placeholder="Detalhes sobre o evento..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data do evento *</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                value={eventDate}
                                onChange={e => setEventDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Horário <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                            <input
                                type="time"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                value={eventTime}
                                onChange={e => setEventTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            <MapPin size={11} className="inline mr-0.5" />
                            Local <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                        </label>
                        <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            placeholder="Ex: Campo do clube"
                            value={eventLocation}
                            onChange={e => setEventLocation(e.target.value)}
                        />
                    </div>

                    {/* Icon picker */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ícone <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                        <div className="flex flex-wrap gap-1.5">
                            {EVENT_ICONS_CLOSE.map(ic => (
                                <button
                                    key={ic}
                                    type="button"
                                    onClick={() => setEventIcon(p => p === ic ? '' : ic)}
                                    className={`h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors border ${eventIcon === ic ? 'border-slate-900 bg-slate-100 dark:border-white dark:bg-white/10' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cost */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            <DollarSign size={11} className="inline mr-0.5" />
                            Custo <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                        </label>
                        <div className="flex gap-2">
                            {(['', 'individual', 'group'] as const).map(ct => (
                                <button
                                    key={ct}
                                    type="button"
                                    onClick={() => setCostType(ct)}
                                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${costType === ct ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                                >
                                    {ct === '' ? 'Sem custo' : ct === 'individual' ? 'Por pessoa' : 'Grupo (rateio)'}
                                </button>
                            ))}
                        </div>
                        {costType !== '' && (
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                placeholder={costType === 'individual' ? 'R$ por pessoa' : 'R$ total do grupo'}
                                value={costAmount}
                                onChange={e => setCostAmount(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            <Clock size={11} className="inline mr-0.5" />
                            Prazo de resposta <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                value={deadlineDate}
                                onChange={e => setDeadlineDate(e.target.value)}
                            />
                            <input
                                type="time"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                value={deadlineTime}
                                onChange={e => setDeadlineTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Show votes toggle */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-700/30 p-3">
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    {showVotes ? <Eye size={15} /> : <EyeOff size={15} />}
                                    Votos visíveis
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Mostrar quem confirmou/recusou</p>
                            </div>
                            <div
                                onClick={() => setShowVotes(p => !p)}
                                className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${showVotes ? 'bg-slate-900' : 'bg-slate-200 dark:bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showVotes ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </label>
                    </div>
                </div>

                <div className="px-5 py-3 border-t dark:border-slate-700 flex gap-2 justify-end shrink-0">
                    <button onClick={onClose} type="button" className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={saving || !title.trim() || !eventDate}
                        type="button"
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Criar evento
                    </button>
                </div>
                <div className="sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
            </div>
        </ModalBackdrop>
    );
}

export default PollCreateEventModal;
