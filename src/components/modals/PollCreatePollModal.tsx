import { useState } from 'react';
import { toast } from 'sonner';
import {
    X, Loader2, Check, Eye, EyeOff, Clock, ChevronRight,
    Plus, Vote, Image, Trash2,
    CheckSquare, Square,
} from 'lucide-react';
import { PollsApi } from '../../api/endpoints';
import { extractApiError } from '../../lib/apiError';
import { compressImage } from '../../lib/compressImage';
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

interface OptionDraft {
    text: string;
    description: string;
    images: string[];
}

interface PollCreatePollModalProps {
    groupId: string;
    onClose: () => void;
    onCreate: (poll: Poll) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_OPTION_DRAFT: OptionDraft = {
    text: '', description: '', images: [],
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
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 p-4 shadow-sm space-y-3">
            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Texto da opção *</label>
                <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="Ex: Churrasco no domingo"
                    value={draft.text}
                    onChange={e => onChange({ ...draft, text: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Descrição <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    rows={2}
                    placeholder="Detalhes sobre esta opção..."
                    value={draft.description}
                    onChange={e => onChange({ ...draft, description: e.target.value })}
                />
            </div>

            {/* Multi-image upload */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    <Image size={11} className="inline mr-1" />
                    Fotos <span className="font-normal text-slate-400">(opcional · máx. 8)</span>
                </label>

                {/* Thumbnails strip */}
                {draft.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                        {draft.images.map((src, idx) => (
                            <div key={idx} className="relative group">
                                <img src={src} alt="" className="h-16 w-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600" />
                                <button type="button"
                                    onClick={() => onChange({ ...draft, images: draft.images.filter((_, i) => i !== idx) })}
                                    className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow transition-colors opacity-0 group-hover:opacity-100">
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add photo zone */}
                {draft.images.length < 8 && (
                    <label className="flex items-center gap-2 cursor-pointer w-full rounded-lg border-2 border-dashed px-3 py-2.5 text-sm transition-colors border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <Plus size={14} />
                        <span>{draft.images.length === 0 ? 'Adicionar foto' : 'Adicionar mais'}</span>
                        <input type="file" accept="image/*" multiple className="hidden"
                            onChange={async e => {
                                const files = Array.from(e.target.files ?? []);
                                const remaining = 8 - draft.images.length;
                                const toProcess = files.slice(0, remaining);
                                const compressed: string[] = [];
                                for (const file of toProcess) {
                                    if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: máximo 5 MB.`); continue; }
                                    try { compressed.push(await compressImage(file)); } catch { toast.error('Erro ao processar imagem.'); }
                                }
                                if (compressed.length) onChange({ ...draft, images: [...draft.images, ...compressed] });
                                e.target.value = '';
                            }} />
                    </label>
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
    const [deletingOption, setDeletingOption] = useState<string | null>(null);
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
                images: optionDraft.images,
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

    async function handleDeleteOption(optionId: string) {
        if (!currentPoll) return;
        setDeletingOption(optionId);
        try {
            await PollsApi.deleteOption(groupId, currentPoll.id, optionId);
            const res = await PollsApi.getPoll(groupId, currentPoll.id);
            setCurrentPoll(res.data.data);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao excluir opção.'));
        } finally { setDeletingOption(null); }
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
                                    {(currentPoll?.options ?? []).map((opt, i) => {
                                        const isDeleting = deletingOption === opt.id;
                                        const imgs = opt.images ?? [];
                                        return (
                                            <div key={opt.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 overflow-hidden">
                                                <div className="flex items-center gap-2 px-2 py-2">
                                                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'][i % 6] }}>
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{opt.text}</p>
                                                        {opt.description && <p className="text-xs text-slate-400 truncate">{opt.description}</p>}
                                                    </div>
                                                    {imgs.length > 0 && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Image size={11} className="text-slate-400" />
                                                            <span className="text-[10px] text-slate-400">{imgs.length}</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteOption(opt.id)}
                                                        disabled={isDeleting}
                                                        className="h-6 w-6 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shrink-0 disabled:opacity-40"
                                                    >
                                                        {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                                    </button>
                                                </div>
                                                {/* Image thumbnails */}
                                                {imgs.length > 0 && (
                                                    <div className="flex gap-1 px-2 pb-2">
                                                        {imgs.slice(0, 5).map((src, idx) => (
                                                            <img key={idx} src={src} alt="" className="h-12 w-12 object-cover rounded-lg border border-slate-200 dark:border-slate-600 shrink-0" />
                                                        ))}
                                                        {imgs.length > 5 && (
                                                            <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                                                                +{imgs.length - 5}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
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
