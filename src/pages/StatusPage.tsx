import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Database,
    HardDrive,
    Loader2,
    RefreshCw,
    Server,
    ShieldAlert,
    Wifi,
    XCircle,
} from 'lucide-react';
import { apiBaseUrl } from '../api/http';
import { getResponseMessage } from '../api/apiResponse';
import { StatusApi, type EnvironmentCheckDto, type SystemStatusDto } from '../api/endpoints';

const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    ok: {
        label: 'Operacional',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: CheckCircle2,
    },
    degraded: {
        label: 'Degradado',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: AlertTriangle,
    },
    down: {
        label: 'Fora',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: XCircle,
    },
    not_configured: {
        label: 'Não configurado',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
        icon: ShieldAlert,
    },
};

const KIND_ICON: Record<string, typeof Server> = {
    database: Database,
    jobs: Clock3,
    'cache-stream': Wifi,
    push: Server,
    storage: HardDrive,
    'external-api': Server,
};

function statusMeta(status: string) {
    return STATUS_META[status] ?? STATUS_META.degraded;
}

function formatDate(value?: string) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
    }).format(new Date(value));
}

function CheckCard({ check }: { check: EnvironmentCheckDto }) {
    const meta = statusMeta(check.status);
    const StatusIcon = meta.icon;
    const KindIcon = KIND_ICON[check.kind] ?? Server;

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <KindIcon size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-950">{check.name}</h2>
                        <p className="mt-1 text-xs text-slate-500">{check.kind}</p>
                    </div>
                </div>

                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                    <StatusIcon size={13} />
                    {meta.label}
                </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700">{check.detail}</p>

            {check.warnings?.length ? (
                <div className="mt-4 space-y-2">
                    {check.warnings.map((warning, index) => (
                        <div
                            key={`${warning.occurredAt}-${index}`}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                        >
                            <div className="flex items-start gap-2 font-bold">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <span>{warning.message}</span>
                            </div>
                            {warning.error && (
                                <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-amber-900">
                                    {warning.error}
                                </p>
                            )}
                            <p className="mt-1 text-[11px] text-amber-700">
                                Ocorrido em {formatDate(warning.occurredAt)}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Duração: {check.durationMs == null ? '-' : `${check.durationMs} ms`}</span>
                <span>Verificado: {formatDate(check.checkedAt)}</span>
            </div>
        </section>
    );
}

export default function StatusPage() {
    const [data, setData] = useState<SystemStatusDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const res = await StatusApi.get();
            setData(res.data.data ?? null);
        } catch (e) {
            setError(getResponseMessage(e, 'Não foi possível carregar o status dos ambientes.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    const counts = useMemo(() => {
        const list = data?.checks ?? [];
        return {
            ok: list.filter(c => c.status === 'ok').length,
            degraded: list.filter(c => c.status === 'degraded').length,
            down: list.filter(c => c.status === 'down').length,
            notConfigured: list.filter(c => c.status === 'not_configured').length,
            warnings: data?.ignoredProblems?.length ?? list.reduce((total, c) => total + (c.warnings?.length ?? 0), 0),
        };
    }, [data]);

    const overallMeta = statusMeta(data?.overall ?? (error ? 'down' : 'degraded'));
    const OverallIcon = overallMeta.icon;

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-6xl space-y-5">
                <header className="rounded-lg bg-slate-950 p-5 text-white shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                                <Server size={21} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black leading-tight">Status dos ambientes</h1>
                                <p className="mt-1 text-xs text-white/60">{apiBaseUrl}</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={load}
                            disabled={loading}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Recarregar
                        </button>
                    </div>
                </header>

                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-lg border ${overallMeta.className}`}>
                                <OverallIcon size={22} />
                            </span>
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-400">Resumo geral</p>
                                <h2 className="text-lg font-black">{error ? 'Falha ao consultar API' : overallMeta.label}</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {data ? `Ambiente: ${data.environment} · ${formatDate(data.checkedAt)}` : 'Aguardando verificação'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">
                                <div className="text-lg font-black">{counts.ok}</div>
                                <div className="text-[11px] font-bold uppercase">OK</div>
                            </div>
                            <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-700">
                                <div className="text-lg font-black">{counts.degraded}</div>
                                <div className="text-[11px] font-bold uppercase">Degradado</div>
                            </div>
                            <div className="rounded-lg bg-rose-50 px-4 py-3 text-rose-700">
                                <div className="text-lg font-black">{counts.down}</div>
                                <div className="text-[11px] font-bold uppercase">Fora</div>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-4 py-3 text-slate-600">
                                <div className="text-lg font-black">{counts.notConfigured}</div>
                                <div className="text-[11px] font-bold uppercase">Sem config</div>
                            </div>
                            <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-700">
                                <div className="text-lg font-black">{counts.warnings}</div>
                                <div className="text-[11px] font-bold uppercase">Alertas</div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {error}
                        </div>
                    )}
                </section>

                {data?.ignoredProblems?.length ? (
                    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-black uppercase text-amber-700">Problemas ignorados pela aplicação</p>
                                <h2 className="mt-1 text-base font-black text-amber-950">
                                    A API subiu, mas estes erros foram tolerados para manter o sistema online
                                </h2>
                                <div className="mt-4 space-y-3">
                                    {data.ignoredProblems.map((problem, index) => (
                                        <article
                                            key={`${problem.dependency}-${problem.occurredAt}-${index}`}
                                            className="rounded-lg border border-amber-200 bg-white/70 p-3"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase text-amber-800">
                                                    {problem.dependency}
                                                </span>
                                                <span className="text-xs font-semibold text-amber-700">
                                                    {formatDate(problem.occurredAt)}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm font-bold text-amber-950">{problem.message}</p>
                                            {problem.error && (
                                                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-amber-100">
                                                    {problem.error}
                                                </pre>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}

                {loading && !data ? (
                    <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-slate-500">
                        <Loader2 size={24} className="animate-spin" />
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {(data?.checks ?? []).map(check => (
                            <CheckCard key={`${check.kind}-${check.name}`} check={check} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
