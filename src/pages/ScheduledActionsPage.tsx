import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Bell,
    CalendarClock,
    CheckCircle2,
    Clock3,
    CreditCard,
    Loader2,
    RefreshCw,
    Trash2,
    Users,
    Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import useAccountStore from '../auth/accountStore';
import { getResponseMessage } from '../api/apiResponse';
import { ScheduledActionsApi, type ScheduledActionDto } from '../api/endpoints';

const TYPE_META: Record<string, { label: string; icon: typeof Bell; className: string }> = {
    notification: {
        label: 'Notificacao',
        icon: Bell,
        className: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    configured: {
        label: 'Configurado',
        icon: CalendarClock,
        className: 'border-violet-200 bg-violet-50 text-violet-700',
    },
};

const ENTITY_ICON: Record<string, typeof CalendarClock> = {
    match: CalendarClock,
    match_noquorum: AlertTriangle,
    mvp: Zap,
    poll: Bell,
    calendar: CalendarClock,
    scheduled_match: CalendarClock,
    monthly_payment: CreditCard,
};

function dateKey(item: ScheduledActionDto) {
    return item.scheduledForDisplay.split(' as ')[0] || item.scheduledForDisplay;
}

function sourceMeta(source: string) {
    return TYPE_META[source] ?? TYPE_META.notification;
}

function entityLabel(item: ScheduledActionDto) {
    if (item.entityType === 'match') return item.triggerType === '24h' ? 'Partida - 24h' : 'Partida - 2h';
    if (item.entityType === 'match_noquorum') return 'Quorum';
    if (item.entityType === 'mvp') return item.triggerType === 'finalize' ? 'MVP - finalizacao' : 'MVP - lembrete';
    if (item.entityType === 'poll') return item.triggerType === 'close' ? 'Fechamento' : 'Votacao/Eventos';
    if (item.entityType === 'calendar') return 'Calendario';
    if (item.entityType === 'monthly_payment') return 'Mensalidade';
    if (item.entityType === 'scheduled_match') return item.triggerType === 'manual' ? 'Partida manual' : 'Partida recorrente';
    return item.entityType;
}

function ActionCard({ item, onCancel }: { item: ScheduledActionDto; onCancel: (item: ScheduledActionDto) => void }) {
    const meta = sourceMeta(item.source);
    const SourceIcon = meta.icon;
    const EntityIcon = ENTITY_ICON[item.entityType] ?? CalendarClock;
    const visibleRecipients = item.recipients.slice(0, 8);
    const hiddenCount = Math.max(item.recipientCount - visibleRecipients.length, 0);

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                            <SourceIcon size={14} />
                            {meta.label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            <EntityIcon size={14} />
                            {entityLabel(item)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={14} />
                            {item.status}
                        </span>
                    </div>

                    <h2 className="mt-3 text-base font-bold text-slate-950">{item.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                <Clock3 size={14} />
                                Quando
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{item.scheduledForDisplay}</p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                <Users size={14} />
                                Destinatarios
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {item.recipientCount > 0 ? `${item.recipientCount} pessoa(s)` : item.targetAudience}
                            </p>
                        </div>
                    </div>

                    {item.recipientCount > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {visibleRecipients.map((recipient) => (
                                <span
                                    key={`${recipient.userId ?? recipient.playerId}-${recipient.name}`}
                                    title={recipient.role}
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                >
                                    {recipient.name}
                                    <span className="text-slate-400">({recipient.role})</span>
                                </span>
                            ))}
                            {hiddenCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                                    +{hiddenCount}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {item.canCancel && (
                    <button
                        type="button"
                        onClick={() => onCancel(item)}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                    >
                        <Trash2 size={16} />
                        Cancelar
                    </button>
                )}
            </div>
        </article>
    );
}

export default function ScheduledActionsPage() {
    const activeAccount = useAccountStore((s) => s.accounts.find(a => a.userId === s.activeAccountId));
    const groupId = activeAccount?.activeGroupId ?? null;
    const isAdmin = !!activeAccount?.activeGroupIsAdmin || activeAccount?.roles?.includes('Admin') || activeAccount?.roles?.includes('GodMode');

    const [items, setItems] = useState<ScheduledActionDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const grouped = useMemo(() => {
        const map = new Map<string, ScheduledActionDto[]>();
        for (const item of items) {
            const key = dateKey(item);
            map.set(key, [...(map.get(key) ?? []), item]);
        }
        return Array.from(map.entries());
    }, [items]);

    async function load() {
        if (!groupId || !isAdmin) return;
        setLoading(true);
        setError(null);
        try {
            const res = await ScheduledActionsApi.list(groupId);
            setItems(res.data.data ?? []);
        } catch (err: any) {
            setError(getResponseMessage(err, 'Nao foi possivel carregar os agendamentos.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, isAdmin]);

    async function cancel(item: ScheduledActionDto) {
        if (!groupId || cancellingId) return;
        const ok = window.confirm(`Cancelar "${item.title}" de ${item.scheduledForDisplay}?`);
        if (!ok) return;

        setCancellingId(item.id);
        try {
            await ScheduledActionsApi.cancel(groupId, item.id);
            setItems((current) => current.filter((x) => x.id !== item.id));
            toast.success('Agendamento cancelado.');
        } catch (err: any) {
            toast.error(getResponseMessage(err, 'Nao foi possivel cancelar este agendamento.'));
        } finally {
            setCancellingId(null);
        }
    }

    if (!groupId) {
        return (
            <main className="mx-auto max-w-5xl p-4 sm:p-6">
                <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                    Selecione uma patota para ver os agendamentos.
                </section>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="mx-auto max-w-5xl p-4 sm:p-6">
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
                    Apenas administradores da patota podem ver os agendamentos.
                </section>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-6xl p-4 sm:p-6">
            <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Admin</p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-950">Agendamentos</h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                        Proximas notificacoes e acoes automaticas previstas para a patota.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Recarregar
                </button>
            </header>

            {error && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {loading && items.length === 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
                    <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
                    Carregando agendamentos...
                </section>
            ) : grouped.length === 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
                    Nenhum agendamento futuro encontrado.
                </section>
            ) : (
                <div className="space-y-6">
                    {grouped.map(([day, dayItems]) => (
                        <section key={day} className="space-y-3">
                            <div className="sticky top-0 z-10 -mx-1 bg-slate-50/90 px-1 py-2 backdrop-blur">
                                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{day}</h2>
                            </div>
                            <div className="space-y-3">
                                {dayItems.map((item) => (
                                    <ActionCard key={item.id} item={item} onCancel={cancel} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </main>
    );
}
