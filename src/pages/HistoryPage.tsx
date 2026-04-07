import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, History, Loader2, MapPin, RefreshCw } from "lucide-react";
import { getResponseMessage } from "../api/apiResponse";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMatchId(m: any): string | null {
    const id = m?.id ?? m?.matchId ?? null;
    if (typeof id !== "string") return null;
    const t = id.trim();
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

function normalizeHex(input?: string | null) {
    const v = (input ?? "").trim();
    if (!v) return null;
    return v.startsWith("#") ? v : `#${v}`;
}

function formatDate(playedAt?: string) {
    if (!playedAt) return null;
    const d = new Date(playedAt);
    if (Number.isNaN(d.getTime())) return null;
    return {
        day: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        full: d.toLocaleString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }),
        short: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    };
}

function getScore(m: any) {
    const a = m?.teamAGoals ?? m?.teamAScore ?? m?.scoreA ?? m?.goalsA ?? null;
    const b = m?.teamBGoals ?? m?.teamBScore ?? m?.scoreB ?? m?.goalsB ?? null;
    if (typeof a !== "number" || typeof b !== "number") return null;
    return { a, b };
}

const STATUS_META: Record<string, { cls: string; accent: string }> = {
    final:       { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "#10b981" },
    finalizado:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "#10b981" },
    done:        { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "#10b981" },
    "pós-jogo":  { cls: "bg-orange-50 text-orange-700 border-orange-200",   accent: "#f97316" },
    postgame:    { cls: "bg-orange-50 text-orange-700 border-orange-200",   accent: "#f97316" },
    post:        { cls: "bg-orange-50 text-orange-700 border-orange-200",   accent: "#f97316" },
    playing:     { cls: "bg-blue-50 text-blue-700 border-blue-200",         accent: "#3b82f6" },
    started:     { cls: "bg-blue-50 text-blue-700 border-blue-200",         accent: "#3b82f6" },
    live:        { cls: "bg-blue-50 text-blue-700 border-blue-200",         accent: "#3b82f6" },
    teams:       { cls: "bg-violet-50 text-violet-700 border-violet-200",   accent: "#9333ea" },
    matchmaking: { cls: "bg-violet-50 text-violet-700 border-violet-200",   accent: "#9333ea" },
    accept:      { cls: "bg-amber-50 text-amber-700 border-amber-200",      accent: "#f59e0b" },
    aceitação:   { cls: "bg-amber-50 text-amber-700 border-amber-200",      accent: "#f59e0b" },
};

function statusMeta(raw?: string) {
    const s = (raw ?? "").toLowerCase().trim();
    // direct match first
    if (STATUS_META[s]) return STATUS_META[s];
    // partial match
    for (const [key, val] of Object.entries(STATUS_META)) {
        if (s.includes(key)) return val;
    }
    return { cls: "bg-slate-50 text-slate-600 border-slate-200", accent: "#94a3b8" };
}

function TeamDot({ hex }: { hex?: string | null }) {
    const color = normalizeHex(hex);
    if (!color) return null;
    const isWhite = color.toLowerCase() === "#ffffff";
    return (
        <span
            className={[
                "inline-block h-3.5 w-3.5 rounded-full border shrink-0",
                isWhite ? "border-slate-300 shadow-sm" : "border-white/40",
            ].join(" ")}
            style={{ backgroundColor: color }}
        />
    );
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

const PAGE_SIZE = 20;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
    const nav = useNavigate();
    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    const topRef = useRef<HTMLDivElement | null>(null);

    async function loadHistory() {
        if (!groupId) return;
        setLoading(true);
        try {
            const [histRes, currentRes] = await Promise.allSettled([
                MatchesApi.history(groupId, 400),
                MatchesApi.getCurrent(groupId),
            ]);

            const list: any[] = histRes.status === "fulfilled"
                ? (Array.isArray(histRes.value.data.data) ? histRes.value.data.data : [])
                : [];

            if (currentRes.status === "fulfilled") {
                const current = currentRes.value.data.data as any;
                const currentId = current?.id ?? current?.matchId;
                if (currentId && !list.some((m) => (m?.id ?? m?.matchId) === currentId)) {
                    list.unshift(current);
                }
            }

            setItems(list);
            setPage(1);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar histórico."));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadHistory();
        // eslint-disable-next-line
    }, [groupId]);

    const sorted = useMemo(() => {
        return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
            const da = a?.playedAt ? new Date(a.playedAt).getTime() : 0;
            const db = b?.playedAt ? new Date(b.playedAt).getTime() : 0;
            return db - da;
        });
    }, [items]);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        setPage((p) => clamp(p, 1, totalPages));
    }, [totalPages]);

    const paged = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return sorted.slice(start, start + PAGE_SIZE);
    }, [sorted, page]);

    function goPage(next: number) {
        const p = clamp(next, 1, totalPages);
        setPage(p);
        requestAnimationFrame(() =>
            topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        );
    }

    return (
        <div className="space-y-5" ref={topRef}>

            {/* ── Header ── */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                            <History size={26} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black leading-tight">Histórico</h1>
                            <p className="text-sm text-white/50 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : !groupId ? 'Selecione um grupo'
                                    : `${total} partida${total !== 1 ? 's' : ''} registrada${total !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    {groupId && (
                        <button
                            type="button"
                            onClick={loadHistory}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            Atualizar
                        </button>
                    )}
                </div>
            </div>

            {!groupId ? (
                <div className="card p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                    <Calendar size={36} className="opacity-30" />
                    <span className="text-sm">Selecione um grupo no Dashboard.</span>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-4">

                        {/* ── Loading skeletons ────────────────────── */}
                        {loading && (
                            <div className="grid gap-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-[68px] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                                    />
                                ))}
                            </div>
                        )}

                        {/* ── Empty state ──────────────────────────── */}
                        {!loading && total === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-12 text-center">
                                <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    Nenhuma partida encontrada
                                </div>
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    O histórico aparecerá aqui após a primeira partida finalizada.
                                </div>
                            </div>
                        )}

                        {/* ── Match list ───────────────────────────── */}
                        {!loading && paged.length > 0 && (
                            <div className="grid gap-2">
                                {paged.map((m) => {
                                    const matchId = getMatchId(m);
                                    if (!matchId) return null;

                                    const score = getScore(m);
                                    const teamAHex = normalizeHex(
                                        m?.teamAColorHex ?? m?.teamAColor?.hexValue
                                    );
                                    const teamBHex = normalizeHex(
                                        m?.teamBColorHex ?? m?.teamBColor?.hexValue
                                    );
                                    const statusName = m?.statusName ?? m?.status ?? m?.stepKey ?? "";
                                    const meta = statusMeta(statusName);
                                    const dates = formatDate(m.playedAt);

                                    // Accent strip: winner's color, half-and-half on draw, fallback otherwise
                                    const accentStyle = (() => {
                                        if (score) {
                                            if (score.a > score.b && teamAHex)
                                                return { backgroundColor: teamAHex };
                                            if (score.b > score.a && teamBHex)
                                                return { backgroundColor: teamBHex };
                                            if (score.a === score.b && teamAHex && teamBHex)
                                                return { background: `linear-gradient(to bottom, ${teamAHex} 50%, ${teamBHex} 50%)` };
                                        }
                                        return { backgroundColor: teamAHex ?? meta.accent };
                                    })();

                                    return (
                                        <button
                                            key={matchId}
                                            onClick={() => nav(`${groupId}/${matchId}`)}
                                            className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm active:scale-[0.99] transition-all"
                                        >
                                            <div className="flex items-stretch">
                                                {/* Left accent strip */}
                                                <div
                                                    className="w-1 shrink-0"
                                                    style={accentStyle}
                                                />

                                                {/* Date box — desktop only */}
                                                <div className="hidden sm:flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 border-r border-slate-100 dark:border-slate-800 px-4 py-3 shrink-0 min-w-[62px]">
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                        {dates?.month ?? "—"}
                                                    </span>
                                                    <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">
                                                        {dates?.day ?? "—"}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                        {dates?.time ?? ""}
                                                    </span>
                                                </div>

                                                {/* Body */}
                                                <div className="flex flex-1 items-center gap-3 px-4 py-3 min-w-0">
                                                    <div className="min-w-0 flex-1">
                                                        {/* Date — desktop full / mobile compact */}
                                                        <div className="font-medium text-slate-900 dark:text-white truncate text-sm">
                                                            <span className="sm:hidden">
                                                                {dates?.short ?? matchId}
                                                            </span>
                                                        </div>

                                                        {/* Meta row */}
                                                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                                            {/* Team color swatches */}
                                                            {(teamAHex || teamBHex) && (
                                                                <div className="flex items-center gap-1">
                                                                    <TeamDot hex={teamAHex} />
                                                                    <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold">
                                                                        vs
                                                                    </span>
                                                                    <TeamDot hex={teamBHex} />
                                                                </div>
                                                            )}

                                                            {/* Status badge */}
                                                            <span
                                                                className={[
                                                                    "text-[10px] font-medium rounded-full border px-2 py-0.5",
                                                                    meta.cls,
                                                                ].join(" ")}
                                                            >
                                                                {statusName}
                                                            </span>

                                                            {/* Place — hidden on mobile */}
                                                            {m?.placeName && (
                                                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                                                    <MapPin size={10} className="shrink-0" />
                                                                    <span className="truncate">{m.placeName}</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Place — mobile only */}
                                                        {m?.placeName && (
                                                            <div className="sm:hidden mt-1 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                                                <MapPin size={10} className="shrink-0" />
                                                                <span className="truncate">{m.placeName}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Score or arrow */}
                                                    {score ? (
                                                        <div className="shrink-0 rounded-xl bg-slate-900 dark:bg-white px-3 py-2 text-center min-w-[52px]">
                                                            <span className="text-base font-bold leading-none text-white dark:text-slate-900 tabular-nums">
                                                                {score.a} <span className="opacity-50">×</span> {score.b}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <ChevronRight
                                                            size={16}
                                                            className="shrink-0 text-slate-300 dark:text-slate-600"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Pagination ───────────────────────────── */}
                        {total > PAGE_SIZE && (
                            <div className="flex items-center justify-between gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => goPage(page - 1)}
                                    disabled={page <= 1 || loading}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={14} />
                                    Anterior
                                </button>

                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Página{" "}
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{page}</span>
                                    {" "}de{" "}
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{totalPages}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => goPage(page + 1)}
                                    disabled={page >= totalPages || loading}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Próxima
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}

                    </div>
                )}
        </div>
    );
}
