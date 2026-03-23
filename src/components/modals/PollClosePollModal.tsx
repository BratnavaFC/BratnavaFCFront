import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Lock, CalendarPlus, DollarSign,
} from 'lucide-react';
import ModalBackdrop from './ModalBackdrop';

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_ICONS_CLOSE = ['🥩','🍺','🎂','🎉','⚽','🏆','🎵','🍔','🎯','🌟','🤝','🚀','📅','🎊'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PollClosePollModalProps {
    pollTitle: string;
    saving: boolean;
    onClose: () => void;
    onConfirm: (dto: any) => void;
}

// ─── PollClosePollModal ───────────────────────────────────────────────────────

function PollClosePollModal({
    pollTitle, saving, onClose, onConfirm,
}: PollClosePollModalProps) {
    const [createEvent, setCreateEvent] = useState(false);
    const [eventTitle, setEventTitle] = useState(pollTitle);
    const [eventDesc, setEventDesc] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventIcon, setEventIcon] = useState('');
    const [costType, setCostType] = useState('');
    const [costAmount, setCostAmount] = useState('');

    function handleConfirm() {
        if (createEvent && !eventDate) { toast.error('Informe a data do evento.'); return; }
        if (createEvent && !eventTitle.trim()) { toast.error('Informe o título do evento.'); return; }
        onConfirm({
            createEvent,
            eventTitle: createEvent ? eventTitle.trim() : null,
            eventDescription: eventDesc.trim() || null,
            eventDate: createEvent ? eventDate : null,
            eventTime: eventTime || null,
            eventIcon: eventIcon || null,
            costType: costType || null,
            costAmount: costAmount ? parseFloat(costAmount) : null,
        });
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 flex flex-col overflow-hidden">
                <div className="sm:hidden flex justify-center pt-2">
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>
                <div className="px-5 py-4 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                            <Lock size={17} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Encerrar votação</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{pollTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Create event toggle */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-700/30 p-4">
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <CalendarPlus size={15} className="text-violet-500" />
                                    Criar evento no calendário
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Com base no resultado desta votação</p>
                            </div>
                            <div
                                onClick={() => setCreateEvent(p => !p)}
                                className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 ${createEvent ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${createEvent ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </label>
                    </div>

                    {createEvent && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Título do evento *</label>
                                <input
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                    value={eventTitle}
                                    onChange={e => setEventTitle(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Descrição <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                                <textarea
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                    rows={2}
                                    value={eventDesc}
                                    onChange={e => setEventDesc(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data *</label>
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
                                            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${costType === ct ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
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
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t dark:border-slate-700 flex gap-2 justify-end shrink-0">
                    <button onClick={onClose} type="button" className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        type="button"
                        className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                        Encerrar votação
                    </button>
                </div>
                <div className="sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
            </div>
        </ModalBackdrop>
    );
}

export default PollClosePollModal;
