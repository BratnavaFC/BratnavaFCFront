import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Check, Eye, EyeOff, Clock,
    Plus, Vote, Image, ChevronRight,
    CheckSquare, Square,
} from 'lucide-react';
import { PollsApi } from '../../api/endpoints';
import { extractApiError } from '../../lib/apiError';
import ModalBackdrop from './ModalBackdrop';

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

interface PollCreatePollModalProps {
    groupId: string;
    onClose: () => void;
    onCreate: (poll: Poll) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_OPTION_DRAFT: OptionDraft = {
    text: '', description: '', imageUrl: '', _dragOver: false,
};

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
            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Texto da opção *</label>
                <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="Ex: Churrasco no domingo"
                    value={draft.text}
                    onChange={e => set('text', e.target.value)}
                />
            </div>

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

// ─── PollCreatePollModal ──────────────────────────────────────────────────────

function PollCreatePollModal({
    groupId, onClose, onCreate,
}: PollCreatePollModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [saving, setSaving] = useState(false);

    // Step 1 form
    const [title, setTitle] = useState('');
    const [description, setDesc] = useState('');
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [showVotes, setShowVotes] = useState(false);
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [addToCalendar, setAddToCalendar] = useState(false);

    // Step 2: options
    const [addingOption, setAddingOption] = useState(false);
    const [optionDraft, setOptionDraft] = useState<OptionDraft>(EMPTY_OPTION_DRAFT);
    const [savingOption, setSavingOption] = useState(false);
    const [currentPoll, setCurrentPoll] = useState<Poll | null>(null);

    async function handleCreatePoll() {
        if (!title.trim()) { toast.error('Título é obrigatório.'); return; }
        setSaving(true);
        try {
            const res = await PollsApi.createPoll(groupId, { title: title.trim(), description: description.trim() || null, allowMultipleVotes: allowMultiple, showVotes, deadlineDate: deadlineDate || null, deadlineTime: deadlineTime || null, addToCalendar: !!deadlineDate && addToCalendar });
            setCurrentPoll(res.data.data);
            setStep(2);
            setAddingOption(true);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao criar votação.'));
        } finally { setSaving(false); }
    }

    async function saveOptionDraft() {
        if (!optionDraft.text.trim()) { toast.error('Texto é obrigatório.'); return; }
        if (!currentPoll) return;
        setSavingOption(true);
        try {
            const dto = {
                text: optionDraft.text,
                description: optionDraft.description || null,
                imageUrl: optionDraft.imageUrl || null,
            };
            await PollsApi.addOption(groupId, currentPoll.id, dto);
            const res = await PollsApi.getPoll(groupId, currentPoll.id);
            setCurrentPoll(res.data.data);
            setOptionDraft(EMPTY_OPTION_DRAFT);
            setAddingOption(false);
            toast.success('Opção adicionada!');
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao adicionar opção.'));
        } finally { setSavingOption(false); }
    }

    function handleFinish() {
        if (currentPoll) onCreate(currentPoll);
        onClose();
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 flex flex-col overflow-hidden">
                {/* Drag handle */}
                <div className="sm:hidden flex justify-center pt-2">
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>

                {/* Header */}
                <div className="px-5 py-4 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                            <Vote size={17} />
                        </div>
                        <div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Passo {step} de 2</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {step === 1 ? 'Configurar votação' : 'Adicionar opções'}
                            </p>
                        </div>
                    </div>
                    {/* Step dots */}
                    <div className="flex items-center gap-1.5 mr-2">
                        {[1, 2].map(s => (
                            <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-5 bg-slate-900 dark:bg-white' : 'w-1.5 bg-slate-200 dark:bg-slate-600'}`} />
                        ))}
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Título *</label>
                                <input
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                    placeholder="Ex: Onde vamos comemorar?"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Descrição <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                                <textarea
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                    rows={2}
                                    placeholder="Contexto da votação..."
                                    value={description}
                                    onChange={e => setDesc(e.target.value)}
                                />
                            </div>

                            {/* Opções de configuração */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-700/30 p-4 space-y-3">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Configurações</p>

                                <label className="flex items-center justify-between gap-3 cursor-pointer">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                            {allowMultiple ? <CheckSquare size={15} /> : <Square size={15} />}
                                            Múltipla escolha
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Permitir votar em mais de uma opção</p>
                                    </div>
                                    <div
                                        onClick={() => setAllowMultiple(p => !p)}
                                        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${allowMultiple ? 'bg-slate-900' : 'bg-slate-200 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${allowMultiple ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                </label>

                                <div className="h-px bg-slate-200 dark:bg-slate-600" />

                                <label className="flex items-center justify-between gap-3 cursor-pointer">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                            {showVotes ? <Eye size={15} /> : <EyeOff size={15} />}
                                            Votos visíveis
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Mostrar quem votou em cada opção</p>
                                    </div>
                                    <div
                                        onClick={() => setShowVotes(p => !p)}
                                        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${showVotes ? 'bg-slate-900' : 'bg-slate-200 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showVotes ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                </label>

                                <div className="h-px bg-slate-200 dark:bg-slate-600" />

                                <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                                        <Clock size={15} />
                                        Prazo de votação <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                            value={deadlineDate}
                                            onChange={e => { setDeadlineDate(e.target.value); if (!e.target.value) setAddToCalendar(false); }}
                                        />
                                        <input
                                            type="time"
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                            value={deadlineTime}
                                            onChange={e => setDeadlineTime(e.target.value)}
                                            placeholder="Hora (opcional)"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Após esse prazo, ninguém poderá mais votar.</p>
                                </div>

                                {deadlineDate && (
                                    <>
                                        <div className="h-px bg-slate-200 dark:bg-slate-600" />
                                        <label className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setAddToCalendar(p => !p)}>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                    {addToCalendar ? <CheckSquare size={15} /> : <Square size={15} />}
                                                    Adicionar ao calendário
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Cria um lembrete no calendário com a data do prazo</p>
                                            </div>
                                            <div className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${addToCalendar ? 'bg-slate-900' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${addToCalendar ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                            </div>
                                        </label>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Current options list */}
                            {(currentPoll?.options ?? []).length > 0 && (
                                <div className="space-y-2">
                                    {(currentPoll?.options ?? []).map((opt, i) => (
                                        <div key={opt.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                                            <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'][i % 6] }}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{opt.text}</p>
                                            </div>
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add option form */}
                            {addingOption ? (
                                <OptionDraftForm
                                    draft={optionDraft}
                                    onChange={setOptionDraft}
                                    onSave={saveOptionDraft}
                                    onCancel={() => { setAddingOption(false); setOptionDraft(EMPTY_OPTION_DRAFT); }}
                                    saving={savingOption}
                                    isEdit={false}
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setAddingOption(true); setOptionDraft(EMPTY_OPTION_DRAFT); }}
                                    className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 py-3 text-sm text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={15} /> Adicionar opção
                                </button>
                            )}

                            {(currentPoll?.options ?? []).length === 0 && !addingOption && (
                                <p className="text-center text-xs text-slate-400 py-4">
                                    Adicione pelo menos uma opção antes de concluir.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t dark:border-slate-700 flex gap-2 justify-end shrink-0">
                    {step === 1 ? (
                        <>
                            <button onClick={onClose} type="button" className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreatePoll}
                                disabled={saving || !title.trim()}
                                type="button"
                                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                                Próximo
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleFinish}
                                disabled={(currentPoll?.options ?? []).length === 0 || addingOption}
                                type="button"
                                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Check size={14} />
                                Concluir votação
                            </button>
                        </>
                    )}
                </div>
                <div className="sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
            </div>
        </ModalBackdrop>
    );
}

export default PollCreatePollModal;
