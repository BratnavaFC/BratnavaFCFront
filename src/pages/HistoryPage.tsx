import { useEffect, useMemo, useState } from "react";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/UseIsMobile";

function getMatchId(m: any): string | null {
    const id = m?.matchId ?? m?.id ?? null;
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

    const date = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
    });

    const time = d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });

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

    if (s.includes("post") || s.includes("final"))
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

    if (s.includes("live") || s.includes("progress"))
        return "bg-blue-50 text-blue-700 border-blue-200";

    return "bg-slate-50 text-slate-700 border-slate-200";
}

function TeamSwatch({ hex }: { hex?: string }) {
    const color = normalizeHex(hex);
    if (!color) return null;

    return (
        <span
            className="h-3 w-3 rounded-full border border-slate-200"
            style={{ backgroundColor: color }}
        />
    );
}

export default function HistoryPage() {

 
    const nav = useNavigate();
    const isMobile = useIsMobile();
    console.log("isMobile?", isMobile, window.innerWidth);

    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            if (!groupId) return;
            setLoading(true);
            try {
                const res = await MatchesApi.list(groupId);
                setItems(res.data ?? []);
            } finally {
                setLoading(false);
            }
        })();
    }, [groupId]);

    const sorted = useMemo(() => {
        return [...items].sort((a, b) => {
            const da = a?.playedAt ? new Date(a.playedAt).getTime() : 0;
            const db = b?.playedAt ? new Date(b.playedAt).getTime() : 0;
            return db - da;
        });
    }, [items]);

    return (
        <div className="space-y-4">
            <Section title="Histórico">
                {!groupId ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        Selecione um grupo no Dashboard.
                    </div>
                ) : (
                    <div className="grid gap-2">
                        {sorted.map((m) => {
                            const matchId = getMatchId(m);
                            if (!matchId) return null;

                            const score = getScore(m);
                            const teamAHex = m?.teamAColor?.hexValue;
                            const teamBHex = m?.teamBColor?.hexValue;

                            const when = isMobile
                                ? formatPlayedAtMobile(m.playedAt)
                                : formatPlayedAtDesktop(m.playedAt);

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
                                            <div className="flex items-center justify-between">
                                                <div className="truncate text-sm font-medium text-slate-900">
                                                    {when ?? matchId}
                                                </div>

                                                {score ? (
                                                    <div className="text-sm font-semibold tabular-nums">
                                                        {score.a}
                                                        <span className="mx-1 text-slate-400">x</span>
                                                        {score.b}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">→</span>
                                                )}
                                            </div>

                                            <div className="mt-1 flex items-center gap-2 text-[11px]">
                                                <TeamSwatch hex={teamAHex} />
                                                <span className="text-slate-300">vs</span>
                                                <TeamSwatch hex={teamBHex} />

                                                <span
                                                    className={[
                                                        "ml-2 rounded-full border px-2 py-0.5",
                                                        statusStyle(m?.statusName ?? m?.status),
                                                    ].join(" ")}
                                                >
                                                    {m?.statusName ?? m?.status}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        /* ================= DESKTOP ================= */
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-slate-900">
                                                    {when ?? matchId}
                                                </div>

                                                <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                                                    <div className="flex items-center gap-1">
                                                        <TeamSwatch hex={teamAHex} />
                                                        <span>vs</span>
                                                        <TeamSwatch hex={teamBHex} />
                                                    </div>

                                                    <span
                                                        className={[
                                                            "rounded-full border px-2 py-0.5",
                                                            statusStyle(m?.statusName ?? m?.status),
                                                        ].join(" ")}
                                                    >
                                                        {m?.statusName ?? m?.status}
                                                    </span>

                                                    {m?.placeName && (
                                                        <span className="text-slate-500">
                                                            • {m.placeName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {score && (
                                                <div className="text-lg font-semibold tabular-nums">
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
                )}
            </Section>
        </div>
    );
}