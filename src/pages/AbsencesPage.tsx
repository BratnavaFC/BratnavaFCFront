import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarOff, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AbsencesApi, type AbsenceDto, type CreateAbsenceDto } from '../api/endpoints';
import { getResponseMessage } from '../api/apiResponse';
import { IconRenderer } from '../components/IconRenderer';
import { ABSENCE_TYPE_OPTIONS, resolveAbsenceIcon } from '../lib/absenceIcons';
import ModalBackdrop from '../components/modals/ModalBackdrop';
import LoadMoreButton from '../components/LoadMoreButton';
import { useConfirm } from '../components/ConfirmDialog';
import useAccountStore from '../auth/accountStore';

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

interface FlatAbsence extends AbsenceDto {
    playerId:   string;
    playerName: string;
}

interface PagedAbsences {
    items: FlatAbsence[];
    total: number;
    page:  number;
}

const EMPTY_PAGE: PagedAbsences = { items: [], total: 0, page: 1 };
const PAGE_SIZE = 20;

const MONTH_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function monthLabel(iso: string) {
    const [y, m] = iso.split('-');
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── AbsencesPage ──────────────────────────────────────────────────────────────

export default function AbsencesPage() {
    const groupId        = useAccountStore(s => s.getActive()?.activeGroupId);
    const activePlayerId = useAccountStore(s => s.getActive()?.activePlayerId);
    const { confirm, confirmDialog } = useConfirm();

    const [upcomingPage, setUpcomingPage] = useState<PagedAbsences>(EMPTY_PAGE);
    const [pastPage, setPastPage]         = useState<PagedAbsences>(EMPTY_PAGE);
    const [pastLoaded, setPastLoaded]     = useState(false);
    const [loading, setLoading]           = useState(false);
    const [loadingMore, setLoadingMore]   = useState(false);
    const [loadingPast, setLoadingPast]   = useState(false);
    const [modalOpen, setModalOpen]       = useState(false);
    const [editTarget, setEditTarget]     = useState<AbsenceDto | null>(null);
    const [showPast, setShowPast]         = useState(false);

    useEffect(() => { if (groupId) fetchAll(); }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchUpcoming(pageNum = 1, append = false) {
        if (!groupId) return;
        append ? setLoadingMore(true) : setLoading(true);
        try {
            const res = await AbsencesApi.byGroup(groupId, { status: 'upcoming', page: pageNum, pageSize: PAGE_SIZE });
            const data = (res.data as any)?.data as { items: FlatAbsence[]; total: number } | undefined;
            setUpcomingPage(prev => ({
                items: append ? [...prev.items, ...(data?.items ?? [])] : (data?.items ?? []),
                total: data?.total ?? 0,
                page:  pageNum,
            }));
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao carregar ausências.'));
        } finally {
            append ? setLoadingMore(false) : setLoading(false);
        }
    }

    async function fetchPast(pageNum = 1, append = false) {
        if (!groupId) return;
        setLoadingPast(true);
        try {
            const res = await AbsencesApi.byGroup(groupId, { status: 'past', page: pageNum, pageSize: PAGE_SIZE });
            const data = (res.data as any)?.data as { items: FlatAbsence[]; total: number } | undefined;
            setPastPage(prev => ({
                items: append ? [...prev.items, ...(data?.items ?? [])] : (data?.items ?? []),
                total: data?.total ?? 0,
                page:  pageNum,
            }));
            setPastLoaded(true);
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao carregar ausências encerradas.'));
        } finally {
            setLoadingPast(false);
        }
    }

    async function fetchAll() {
        setPastLoaded(false);
        setPastPage(EMPTY_PAGE);
        await fetchUpcoming();
        if (showPast) await fetchPast();
    }

    function togglePast() {
        const next = !showPast;
        setShowPast(next);
        if (next && !pastLoaded) fetchPast();
    }

    function openCreate() { setEditTarget(null); setModalOpen(true); }
    function openEdit(a: AbsenceDto) { setEditTarget(a); setModalOpen(true); }
    function closeModal() { setModalOpen(false); setEditTarget(null); }

    async function handleSave(dto: CreateAbsenceDto) {
        try {
            if (editTarget) {
                const res = await AbsencesApi.update(editTarget.id, dto);
                toast.success((res.data as any)?.message ?? 'Ausência atualizada.');
            } else {
                const res = await AbsencesApi.create(dto);
                toast.success((res.data as any)?.message ?? 'Ausência cadastrada.');
            }
            closeModal();
            await fetchAll();
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao salvar ausência.'));
            throw new Error();
        }
    }

    async function handleDelete(id: string) {
        if (!(await confirm({ title: 'Excluir ausência', message: 'Deseja excluir esta ausência? Os convites recusados automaticamente por ela voltarão a ficar pendentes.', confirmLabel: 'Excluir', danger: true }))) return;
        try {
            await AbsencesApi.delete(id);
            toast.success('Ausência removida.');
            await fetchAll();
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao remover ausência.'));
        }
    }

    const today = todayIso();
    // O backend devolve upcoming = em andamento + futuras, em ordem cronológica
    const ongoing  = useMemo(() =>
        upcomingPage.items.filter(a => a.startDate <= today),
    [upcomingPage.items, today]);
    const upcoming = useMemo(() =>
        upcomingPage.items.filter(a => a.startDate > today),
    [upcomingPage.items, today]);
    const past = pastPage.items;

    // Agrupa as próximas por mês da data inicial
    const upcomingByMonth = useMemo(() => {
        const groups: { label: string; items: FlatAbsence[] }[] = [];
        for (const a of upcoming) {
            const label = monthLabel(a.startDate);
            const last = groups[groups.length - 1];
            if (last && last.label === label) last.items.push(a);
            else groups.push({ label, items: [a] });
        }
        return groups;
    }, [upcoming]);

    const totalAbsences = upcomingPage.total;

    const initialForm: CreateAbsenceDto = editTarget
        ? { startDate: editTarget.startDate, endDate: editTarget.endDate, absenceType: editTarget.absenceType, description: editTarget.description ?? '' }
        : EMPTY_FORM;

    function renderCard(a: FlatAbsence, active: boolean) {
        const isSelf = a.playerId === activePlayerId;
        return (
            <div
                key={a.id}
                className={[
                    'flex items-center gap-3 bg-white dark:bg-slate-900 border rounded-2xl px-4 py-3 shadow-sm',
                    active ? 'border-red-200 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-700',
                ].join(' ')}
            >
                <div className={[
                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                    a.absenceType === 2
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                ].join(' ')}>
                    <IconRenderer value={resolveAbsenceIcon(a.absenceType)} size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {a.playerName}
                        </span>
                        {isSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                                você
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {a.absenceTypeName} · {formatDate(a.startDate)}
                        {a.startDate !== a.endDate && <> até {formatDate(a.endDate)}</>}
                    </div>
                    {a.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate" title={a.description}>
                            {a.description}
                        </div>
                    )}
                </div>

                {isSelf && (
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
                )}
            </div>
        );
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
                            <CalendarOff size={18} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black leading-tight">Ausências</h1>
                            <p className="text-xs text-white/60 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : `${totalAbsences} ausência${totalAbsences !== 1 ? 's' : ''} ativa${totalAbsences !== 1 ? 's' : ''} ou futura${totalAbsences !== 1 ? 's' : ''}`}
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

            {/* ── Loading ── */}
            {loading && (
                <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 size={24} className="animate-spin" />
                </div>
            )}

            {/* ── Lista (por data) ── */}
            {!loading && (
                <div className="flex flex-col gap-5">
                    {upcomingPage.items.length === 0 && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 shadow-sm">
                            <CalendarOff size={36} className="opacity-30" />
                            <p className="text-sm">Nenhuma ausência ativa ou futura.</p>
                        </div>
                    )}

                    {/* Em andamento */}
                    {ongoing.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Fora agora · {ongoing.length}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {ongoing.map(a => renderCard(a, true))}
                            </div>
                        </div>
                    )}

                    {/* Próximas, agrupadas por mês */}
                    {upcomingByMonth.map(group => (
                        <div key={group.label}>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
                                {group.label}
                            </div>
                            <div className="flex flex-col gap-2">
                                {group.items.map(a => renderCard(a, false))}
                            </div>
                        </div>
                    ))}

                    <LoadMoreButton loaded={upcomingPage.items.length} total={upcomingPage.total}
                        loading={loadingMore} onClick={() => fetchUpcoming(upcomingPage.page + 1, true)} />

                    {/* Encerradas (busca sob demanda ao expandir) */}
                    <div>
                        <button
                            onClick={togglePast}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition mb-2 px-1"
                        >
                            Encerradas{pastLoaded ? ` · ${pastPage.total}` : ''}
                            {loadingPast && !pastLoaded
                                ? <Loader2 size={13} className="animate-spin" />
                                : showPast ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {showPast && pastLoaded && (
                            <div className="flex flex-col gap-3">
                                {past.length === 0 && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 px-1">Nenhuma ausência encerrada.</p>
                                )}
                                <div className="flex flex-col gap-2 opacity-60">
                                    {past.map(a => renderCard(a, false))}
                                </div>
                                <LoadMoreButton loaded={past.length} total={pastPage.total}
                                    loading={loadingPast} onClick={() => fetchPast(pastPage.page + 1, true)} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Modal ── */}
            {modalOpen && (
                <AbsenceFormModal
                    key={editTarget?.id ?? 'new'}
                    initial={initialForm}
                    onSave={handleSave}
                    onClose={closeModal}
                />
            )}

            {confirmDialog}
        </div>
    );
}
