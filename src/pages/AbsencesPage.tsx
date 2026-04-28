import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarOff, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AbsencesApi, type AbsenceDto, type CreateAbsenceDto } from '../api/endpoints';
import { getResponseMessage } from '../api/apiResponse';
import { IconRenderer } from '../components/IconRenderer';
import { ABSENCE_TYPE_OPTIONS, resolveAbsenceIcon } from '../lib/absenceIcons';
import ModalBackdrop from '../components/modals/ModalBackdrop';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

const EMPTY_FORM: CreateAbsenceDto = {
    startDate:   '',
    endDate:     '',
    absenceType: 1,
    description: '',
};

// ── AbsenceFormModal ──────────────────────────────────────────────────────────

function AbsenceFormModal({
    initial,
    onSave,
    onClose,
}: {
    initial: CreateAbsenceDto;
    onSave: (dto: CreateAbsenceDto) => Promise<void>;
    onClose: () => void;
}) {
    const [form, setForm]     = useState<CreateAbsenceDto>(initial);
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.startDate || !form.endDate) { toast.error('Informe o período.'); return; }
        if (form.endDate < form.startDate)     { toast.error('Data final não pode ser anterior à inicial.'); return; }
        setSaving(true);
        try {
            await onSave(form);
        } finally {
            setSaving(false);
        }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col">
                {/* header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {initial.startDate ? 'Editar ausência' : 'Nova ausência'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
                    {/* período */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">De</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Até</label>
                            <input
                                type="date"
                                value={form.endDate}
                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>
                    </div>

                    {/* tipo */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Motivo</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ABSENCE_TYPE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, absenceType: opt.value }))}
                                    className={[
                                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all',
                                        form.absenceType === opt.value
                                            ? 'border-slate-800 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500',
                                    ].join(' ')}
                                >
                                    <span className={form.absenceType === opt.value && opt.value === 2 ? 'text-red-400' : opt.value === 2 ? 'text-red-500' : ''}>
                                        <IconRenderer value={opt.icon} size={14} />
                                    </span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* descrição */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Descrição <span className="font-normal text-slate-400">(opcional)</span>
                        </label>
                        <textarea
                            value={form.description ?? ''}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            placeholder="Ex: Férias em família…"
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>

                    {/* actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-200 disabled:opacity-50 text-white dark:text-slate-900 text-sm font-semibold py-2 transition flex items-center justify-center gap-1.5"
                        >
                            {saving && <Loader2 size={13} className="animate-spin" />}
                            {saving ? 'Salvando…' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalBackdrop>
    );
}

// ── AbsencesPage ──────────────────────────────────────────────────────────────

export default function AbsencesPage() {
    const [absences, setAbsences]     = useState<AbsenceDto[]>([]);
    const [loading, setLoading]       = useState(false);
    const [modalOpen, setModalOpen]   = useState(false);
    const [editTarget, setEditTarget] = useState<AbsenceDto | null>(null);

    useEffect(() => { fetchMine(); }, []);

    async function fetchMine() {
        setLoading(true);
        try {
            const res = await AbsencesApi.mine();
            setAbsences((res.data as any)?.data ?? []);
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao carregar ausências.'));
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditTarget(null);
        setModalOpen(true);
    }

    function openEdit(a: AbsenceDto) {
        setEditTarget(a);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setEditTarget(null);
    }

    async function handleSave(dto: CreateAbsenceDto) {
        try {
            if (editTarget) {
                await AbsencesApi.update(editTarget.id, dto);
                toast.success('Ausência atualizada.');
            } else {
                await AbsencesApi.create(dto);
                toast.success('Ausência cadastrada.');
            }
            closeModal();
            await fetchMine();
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao salvar ausência.'));
            throw new Error(); // keep modal open via finally in child
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Deseja excluir esta ausência?')) return;
        try {
            await AbsencesApi.delete(id);
            toast.success('Ausência removida.');
            await fetchMine();
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao remover ausência.'));
        }
    }

    const initialForm: CreateAbsenceDto = editTarget
        ? { startDate: editTarget.startDate, endDate: editTarget.endDate, absenceType: editTarget.absenceType, description: editTarget.description ?? '' }
        : EMPTY_FORM;

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="page-header">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon">
                            <CalendarOff size={18} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black leading-tight">Ausências</h1>
                            <p className="text-xs text-white/60 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : `${absences.length} ausência${absences.length !== 1 ? 's' : ''} cadastrada${absences.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 shadow-sm"
                    >
                        <Plus size={15} /> Nova ausência
                    </button>
                </div>
            </div>

            {/* ── Lista ── */}
            {loading && (
                <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 size={24} className="animate-spin" />
                </div>
            )}

            {!loading && absences.length === 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 shadow-sm">
                    <CalendarOff size={36} className="opacity-30" />
                    <p className="text-sm">Nenhuma ausência cadastrada.</p>
                    <button
                        onClick={openCreate}
                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                    >
                        <Plus size={14} /> Cadastrar ausência
                    </button>
                </div>
            )}

            {!loading && absences.length > 0 && (
                <div className="flex flex-col gap-2">
                    {absences.map(a => (
                        <div
                            key={a.id}
                            className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                        >
                            {/* ícone */}
                            <div className={[
                                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                                a.absenceType === 2
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                            ].join(' ')}>
                                <IconRenderer value={resolveAbsenceIcon(a.absenceType)} size={18} />
                            </div>

                            {/* info */}
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                                    {a.absenceTypeName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {formatDate(a.startDate)}
                                    {a.startDate !== a.endDate && <> até {formatDate(a.endDate)}</>}
                                </div>
                                {a.description && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate" title={a.description}>
                                        {a.description}
                                    </div>
                                )}
                            </div>

                            {/* ações */}
                            <div className="flex gap-1 shrink-0">
                                <button
                                    title="Editar"
                                    onClick={() => openEdit(a)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition"
                                >
                                    <Pencil size={13} />
                                </button>
                                <button
                                    title="Excluir"
                                    onClick={() => handleDelete(a.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Modal de criação/edição ── */}
            {modalOpen && (
                <AbsenceFormModal
                    key={editTarget?.id ?? 'new'}
                    initial={initialForm}
                    onSave={handleSave}
                    onClose={closeModal}
                />
            )}
        </div>
    );
}
