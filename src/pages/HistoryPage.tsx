import React, { useEffect, useMemo, useRef, useState } from "react";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/UseIsMobile";

/** =========================
 * Helpers
 * ========================= */

function getMatchId(m: any): string | null {
    const id = m?.id ?? m?.matchId ?? null;
    if (typeof id !== "string") return null;
    const t = id.trim();
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

function normalizeHex(input?: string) {
    const v = (input ?? "").trim();
    if (!v) return null;
    return v.startsWith("#") ? v : `#${v}`;
}

function formatPlayedAtMobile(playedAt?: string) {
    if (!playedAt) return null;
    const d = new Date(playedAt);
    if (Number.isNaN(d.getTime())) return null;

    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${date} • ${time}`;
}

function formatPlayedAtDesktop(playedAt?: string) {
    if (!playedAt) return null;
    const d = new Date(playedAt);
    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getScore(m: any) {
    const a =
        m?.teamAGoals ?? m?.teamAScore ?? m?.scoreA ?? m?.goalsA ?? null;
    const b =
        m?.teamBGoals ?? m?.teamBScore ?? m?.scoreB ?? m?.goalsB ?? null;

    if (typeof a !== "number" || typeof b !== "number") return null;
    return { a, b };
}

function statusStyle(raw?: string) {
    const s = (raw ?? "").toLowerCase();

    if (s.includes("final") || s.includes("post"))
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

    if (s.includes("start") || s.includes("live") || s.includes("progress"))
        return "bg-blue-50 text-blue-700 border-blue-200";

    if (s.includes("matchmaking") || s.includes("teams"))
        return "bg-violet-50 text-violet-700 border-violet-200";

    if (s.includes("accept"))
        return "bg-amber-50 text-amber-700 border-amber-200";

    return "bg-slate-50 text-slate-700 border-slate-200";
}

function TeamSwatch({ hex }: { hex?: string }) {
    const color = normalizeHex(hex);
    if (!color) return null;

    // ✅ branco precisa de contraste
    const isWhite = color.toLowerCase() === "#ffffff";
    return (
        <span
            className={[
                "h-3 w-3 rounded-full border",
                isWhite ? "border-slate-400 shadow-sm" : "border-slate-200",
            ].join(" ")}
            style={{ backgroundColor: color }}
            title={color}
        />
    );
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

/** =========================
 * Page
 * ========================= */

export default function HistoryPage() {
    const nav = useNavigate();
    const isMobile = useIsMobile();

    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);

    // paginação: seu backend hoje tem "take" apenas.
    // aqui fazemos paginação no client em cima de uma lista leve (já é muito mais rápido que details).
    // se você quiser paginação real no servidor depois, trocamos para skip/take facilmente.
    const PAGE_SIZE = 20;

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // paginação client
    const [page, setPage] = useState(1);

    // UX: lembrar scroll container
    const topRef = useRef<HTMLDivElement | null>(null);

    async function loadHistory() {
        if (!groupId) return;

        setLoading(true);
        try {
            // busca leve (id, playedAt, statusName, score, hex)
            // se você não tiver esse método ainda no endpoints.ts: MatchesApi.history(groupId, take)
            const res = await MatchesApi.history(groupId, 400); // pega bastante e pagina local
            setItems(Array.isArray(res.data) ? res.data : []);
            setPage(1);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadHistory();
        // eslint-disable-next-line
    }, [groupId]);

    const sorted = useMemo(() => {
        const list = Array.isArray(items) ? items : [];
        return [...list].sort((a, b) => {
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
        // scroll pro topo do bloco
        requestAnimationFrame(() => {
            topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    const empty = !loading && total === 0;

    return (
        <div className="space-y-4">
            <div ref={topRef} />

            <Section title="Histórico">
                {!groupId ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        Selecione um grupo no Dashboard.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Header / Controls */}
                        <div
                            className={[
                                "flex items-center justify-between gap-2",
                                isMobile ? "flex-col items-stretch" : "flex-row",
                            ].join(" ")}
                        >
                            <div className="text-xs text-slate-500">
                                {loading ? "Carregando..." : `${total} partida(s)`}
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => loadHistory()}
                                    className={[
                                        "rounded-xl border px-3 py-2 text-sm transition",
                                        loading
                                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                            : "bg-white hover:bg-slate-50 border-slate-200",
                                    ].join(" ")}
                                    disabled={loading}
                                    title="Atualizar"
                                >
                                    Atualizar
                                </button>

                                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                                    <span>Página</span>
                                    <span className="font-medium text-slate-700">
                                        {page}/{totalPages}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Empty state */}
                        {empty && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                Nenhuma partida encontrada.
                            </div>
                        )}

                        {/* List */}
                        <div className="grid gap-2">
                            {paged.map((m) => {
                                const matchId = getMatchId(m);
                                if (!matchId) return null;

                                const score = getScore(m);

                                // ✅ novo endpoint leve retorna assim:
                                const teamAHex = m?.teamAColorHex ?? m?.teamAColor?.hexValue;
                                const teamBHex = m?.teamBColorHex ?? m?.teamBColor?.hexValue;

                                const when = isMobile
                                    ? formatPlayedAtMobile(m.playedAt)
                                    : formatPlayedAtDesktop(m.playedAt);

                                const statusName = m?.statusName ?? m?.status ?? "";

                                return (
                                    <button
                                        key={matchId}
                                        onClick={() => nav(`${groupId}/${matchId}`)}
                                        className={[
                                            "w-full text-left rounded-2xl border border-slate-200 bg-white",
                                            isMobile ? "px-3 py-3" : "px-4 py-4",
                                            "hover:bg-slate-50 active:scale-[0.99] transition",
                                        ].join(" ")}
                                    >
                                        {isMobile ? (
                                            /* ================= MOBILE ================= */
                                            <>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="truncate text-sm font-medium text-slate-900">
                                                        {when ?? matchId}
                                                    </div>

                                                    {score ? (
                                                        <div className="shrink-0 text-sm font-semibold tabular-nums">
                                                            {score.a}
                                                            <span className="mx-1 text-slate-400">x</span>
                                                            {score.b}
                                                        </div>
                                                    ) : (
                                                        <span className="shrink-0 text-xs text-slate-400">→</span>
                                                    )}
                                                </div>

                                                <div className="mt-1 flex items-center gap-2 text-[11px]">
                                                    <TeamSwatch hex={teamAHex} />
                                                    <span className="text-slate-300">vs</span>
                                                    <TeamSwatch hex={teamBHex} />

                                                    <span
                                                        className={[
                                                            "ml-2 rounded-full border px-2 py-0.5",
                                                            statusStyle(statusName),
                                                        ].join(" ")}
                                                    >
                                                        {statusName}
                                                    </span>
                                                </div>

                                                {!!m?.placeName && (
                                                    <div className="mt-1 text-[11px] text-slate-500 truncate">
                                                        {m.placeName}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* ================= DESKTOP ================= */
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="font-medium text-slate-900 truncate">
                                                        {when ?? matchId}
                                                    </div>

                                                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                                                        <div className="flex items-center gap-1">
                                                            <TeamSwatch hex={teamAHex} />
                                                            <span>vs</span>
                                                            <TeamSwatch hex={teamBHex} />
                                                        </div>

                                                        <span
                                                            className={[
                                                                "rounded-full border px-2 py-0.5",
                                                                statusStyle(statusName),
                                                            ].join(" ")}
                                                        >
                                                            {statusName}
                                                        </span>

                                                        {m?.placeName && (
                                                            <span className="text-slate-500">• {m.placeName}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {score && (
                                                    <div className="shrink-0 text-lg font-semibold tabular-nums">
                                                        {score.a}
                                                        <span className="mx-1 text-slate-400">x</span>
                                                        {score.b}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {total > 0 && (
                            <div
                                className={[
                                    "flex items-center gap-2",
                                    isMobile ? "justify-between" : "justify-end",
                                ].join(" ")}
                            >
                                <button
                                    type="button"
                                    onClick={() => goPage(page - 1)}
                                    disabled={page <= 1 || loading}
                                    className={[
                                        "rounded-xl border px-3 py-2 text-sm transition",
                                        page <= 1 || loading
                                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                            : "bg-white hover:bg-slate-50 border-slate-200",
                                    ].join(" ")}
                                >
                                    Anterior
                                </button>

                                <div className="text-xs text-slate-500">
                                    Página <span className="font-medium text-slate-700">{page}</span>{" "}
                                    de <span className="font-medium text-slate-700">{totalPages}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => goPage(page + 1)}
                                    disabled={page >= totalPages || loading}
                                    className={[
                                        "rounded-xl border px-3 py-2 text-sm transition",
                                        page >= totalPages || loading
                                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                            : "bg-white hover:bg-slate-50 border-slate-200",
                                    ].join(" ")}
                                >
                                    Próxima
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Section>
        </div>
    );
}