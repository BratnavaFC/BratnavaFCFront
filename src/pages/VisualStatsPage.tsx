import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TeamGenApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isGodMode } from "../auth/guards";
import {
    BarChart3,
    ChevronDown,
    ChevronUp,
    Layers,
    Medal,
    Search,
    Shield,
    Users,
} from "lucide-react";
import { useGroupIcons } from "../hooks/useGroupIcons";
import { IconRenderer } from "../components/IconRenderer";
import { resolveIcon } from "../lib/groupIcons";

/* ===================== DTOs ===================== */

type PlayerSynergyItem = {
    withPlayerId: string;
    withPlayerName: string;
    matchesTogether: number;
    winsTogether: number;
    winRateTogether: number;
};

type PlayerVisualStatsItem = {
    playerId: string;
    name: string;
    status: number;
    isGoalkeeper: boolean;
    gamesPlayed: number;
    wins: number;
    ties: number;
    losses: number;
    winRate: number;
    mvps: number;
    goals: number;
    assists: number;
    ownGoals: number;
    synergies: PlayerSynergyItem[];
};

type PlayerVisualStatsReport = {
    groupId: string;
    totalMatchesConsidered: number;
    totalFinalizedMatches: number;
    totalMatchesWithScore: number;
    players: PlayerVisualStatsItem[];
};

/* ===================== Helpers ===================== */

function cx(...xs: Array<string | false | undefined | null>) {
    return xs.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function normalizeWR(v: number) {
    if (!Number.isFinite(v)) return 0;
    return clamp(v <= 1 ? v * 100 : v, 0, 100);
}

function pct(v: number) {
    return `${v.toFixed(0)}%`;
}

/** Green ≥60 · Amber 45–59 · Red <45 */
function wrColor(v0to100: number): string {
    if (v0to100 >= 60) return "#16a34a";
    if (v0to100 >= 45) return "#d97706";
    return "#dc2626";
}

function isActive(status: number) {
    return status === 1;
}

/* ===================== Sub-components ===================== */

/** Horizontal W / E / D proportional bar */
function WDLBar({ wins, ties, losses }: { wins: number; ties: number; losses: number }) {
    const total = wins + ties + losses;
    if (total === 0) return <div className="h-2 rounded-full bg-slate-100" />;
    const wPct = (wins / total) * 100;
    const tPct = (ties / total) * 100;
    const lPct = (losses / total) * 100;
    return (
        <div className="flex h-2 w-full rounded-full overflow-hidden gap-px bg-slate-100">
            <div style={{ width: `${wPct}%`, backgroundColor: "#16a34a" }} />
            <div style={{ width: `${tPct}%`, backgroundColor: "#94a3b8" }} />
            <div style={{ width: `${lPct}%`, backgroundColor: "#dc2626" }} />
        </div>
    );
}

/** Thin WR bar with percentage label */
function WRBar({ value }: { value: number }) {
    const color = wrColor(value);
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color }}>
                {pct(value)}
            </span>
        </div>
    );
}

/** Underline-style tab button */
function Tab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                "flex items-center gap-1.5 px-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors",
                active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-600"
            )}
        >
            {children}
        </button>
    );
}

/** Sort chip */
function SortChip({
    active,
    dir,
    onClick,
    children,
}: {
    active: boolean;
    dir?: "asc" | "desc";
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
        >
            {children}
            {active && dir === "asc" && <ChevronUp size={11} />}
            {active && dir === "desc" && <ChevronDown size={11} />}
        </button>
    );
}

/* ===================== Global synergy builder ===================== */

type GlobalSynergyRow = {
    aId: string;
    aName: string;
    bId: string;
    bName: string;
    matches: number;
    wins: number;
    wr: number;
};

function buildGlobalSynergy(players: PlayerVisualStatsItem[]): GlobalSynergyRow[] {
    const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
    const map = new Map<string, GlobalSynergyRow>();

    for (const p of players) {
        for (const s of p.synergies ?? []) {
            if (!s || s.matchesTogether <= 0) continue;
            const k = key(p.playerId, s.withPlayerId);
            const wr = normalizeWR(s.winRateTogether);
            if (!map.has(k)) {
                const [aId, bId] =
                    p.playerId < s.withPlayerId
                        ? [p.playerId, s.withPlayerId]
                        : [s.withPlayerId, p.playerId];
                const [aName, bName] =
                    p.playerId < s.withPlayerId
                        ? [p.name, s.withPlayerName]
                        : [s.withPlayerName, p.name];
                map.set(k, { aId, aName, bId, bName, matches: s.matchesTogether, wins: s.winsTogether, wr });
            } else {
                const cur = map.get(k)!;
                if (s.matchesTogether > cur.matches) {
                    cur.matches = s.matchesTogether;
                    cur.wins = s.winsTogether;
                    cur.wr = wr;
                }
            }
        }
    }

    return Array.from(map.values()).sort((a, b) =>
        b.wr !== a.wr ? b.wr - a.wr : b.matches - a.matches
    );
}

/* ===================== Page ===================== */

type SortKey = "winrate" | "games" | "mvps" | "goals" | "assists" | "owngoals" | "name";
type MainTab = "rankings" | "players";

export default function VisualStatsPage() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const active = useAccountStore((s) => s.getActive());
    const activeGroupId = active?.activeGroupId;
    const _icons = useGroupIcons(groupId ?? activeGroupId);
    const isGroupAdm = !!activeGroupId && (active?.groupAdminIds?.includes(activeGroupId) ?? false);
    const isGod = isGodMode();

    useEffect(() => {
        if (!activeGroupId) return;
        if (!isGroupAdm && !isGod) {
            // usuário não é admin do grupo ativo nem GodMode → volta ao dashboard
            navigate("/app", { replace: true });
            return;
        }
        if (activeGroupId !== groupId) {
            navigate(`/app/groups/${activeGroupId}/visual-stats`, { replace: true });
        }
    }, [activeGroupId, isGroupAdm, isGod, groupId, navigate]);

    const [data, setData] = useState<PlayerVisualStatsReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [mainTab, setMainTab] = useState<MainTab>("rankings");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("winrate");
    const [minTogether, setMinTogether] = useState(1);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                setLoading(true);
                setErr(null);
                if (!groupId) throw new Error("groupId não encontrado.");
                const res: any = await TeamGenApi.visualStats(groupId);
                const payload: PlayerVisualStatsReport = res?.data?.data ?? res?.data ?? res;
                if (!mounted) return;
                setData(payload);
                const first = [...(payload.players ?? [])].sort((a, b) =>
                    a.name.localeCompare(b.name, "pt-BR")
                )[0];
                setSelectedId(first?.playerId ?? null);
            } catch (e: any) {
                if (!mounted) return;
                setErr(e?.message || "Falha ao carregar dados.");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [groupId]);

    const players = data?.players ?? [];

    const sorted = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = [...players];
        if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
        if (sortKey === "winrate")   list.sort((a, b) => normalizeWR(b.winRate) - normalizeWR(a.winRate));
        else if (sortKey === "games")    list.sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0));
        else if (sortKey === "mvps")     list.sort((a, b) => (b.mvps || 0) - (a.mvps || 0));
        else if (sortKey === "goals")    list.sort((a, b) => (b.goals || 0) - (a.goals || 0));
        else if (sortKey === "assists")  list.sort((a, b) => (b.assists || 0) - (a.assists || 0));
        else if (sortKey === "owngoals") list.sort((a, b) => (b.ownGoals || 0) - (a.ownGoals || 0));
        else list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        return list;
    }, [players, search, sortKey]);

    const selectedPlayer = useMemo(
        () => players.find((p) => p.playerId === selectedId) ?? null,
        [players, selectedId]
    );

    const synergies = useMemo(() => {
        if (!selectedPlayer) return [];
        return (selectedPlayer.synergies ?? [])
            .map((s) => ({ ...s, wr: normalizeWR(s.winRateTogether) }))
            .filter((s) => s.matchesTogether >= minTogether)
            .sort((a, b) => b.wr !== a.wr ? b.wr - a.wr : b.matchesTogether - a.matchesTogether);
    }, [selectedPlayer, minTogether]);

    const globalSynergy = useMemo(() => buildGlobalSynergy(players), [players]);

    /* ── Loading ── */
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-6 w-40 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-4 w-64 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-72 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />
            </div>
        );
    }

    if (err) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {err}
            </div>
        );
    }

    if (!data) {
        return <div className="text-sm text-slate-500">Nenhum dado retornado.</div>;
    }

    /* ── UI ── */
    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                {/* Row 1: icon + title + subtitle */}
                <div className="relative flex items-center gap-4 mb-3">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        <BarChart3 size={26} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-tight">Estatísticas</h1>
                        <p className="text-sm text-white/50 mt-0.5">
                            {players.length} jogadores
                            {data.totalFinalizedMatches > 0 && <> · {data.totalFinalizedMatches} partidas finalizadas</>}
                            {data.totalMatchesConsidered > 0 && <> · {data.totalMatchesConsidered} consideradas</>}
                        </p>
                    </div>
                </div>

                {/* Row 2: tabs */}
                <div className="relative flex gap-1">
                    <button type="button" onClick={() => setMainTab("rankings")}
                        className={cx(
                            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                            mainTab === "rankings" ? "bg-white text-slate-900" : "bg-white/10 text-white/80 hover:bg-white/20"
                        )}>
                        <BarChart3 size={13} /> Rankings
                    </button>
                    <button type="button" onClick={() => setMainTab("players")}
                        className={cx(
                            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                            mainTab === "players" ? "bg-white text-slate-900" : "bg-white/10 text-white/80 hover:bg-white/20"
                        )}>
                        <Users size={13} /> Jogadores
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                RANKINGS TAB
            ══════════════════════════════════════════════════════ */}
            {mainTab === "rankings" && (
                <div className="space-y-6">

                    {/* ── Player ranking table ─────────────────────── */}
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

                        {/* Table toolbar */}
                        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold text-slate-800 shrink-0">
                                Ranking de jogadores
                            </span>

                            {/* Search */}
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 flex-1 min-w-[150px] max-w-xs">
                                <Search size={13} className="text-slate-400 shrink-0" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar jogador…"
                                    className="w-full bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Sort chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {(
                                    [
                                        { k: "winrate",  label: "Win Rate" },
                                        { k: "games",    label: "Jogos" },
                                        { k: "mvps",     label: "MVPs" },
                                        { k: "goals",    label: <><IconRenderer value={resolveIcon(_icons, 'goal')} size={13} />{" "}Gols</> },
                                        { k: "assists",  label: <><IconRenderer value={resolveIcon(_icons, 'assist')} size={13} />{" "}Assists</> },
                                        { k: "owngoals", label: <><IconRenderer value={resolveIcon(_icons, 'ownGoal')} size={13} />{" "}GC</> },
                                        { k: "name",     label: "Nome" },
                                    ] as { k: SortKey; label: React.ReactNode }[]
                                ).map(({ k, label }) => (
                                    <SortChip
                                        key={k}
                                        active={sortKey === k}
                                        dir="desc"
                                        onClick={() => setSortKey(k)}
                                    >
                                        {label}
                                    </SortChip>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-2.5 text-left w-10">#</th>
                                        <th className="px-4 py-2.5 text-left">Jogador</th>
                                        <th className="px-4 py-2.5 text-right w-10">J</th>
                                        <th className="px-4 py-2.5 text-center w-24">V / E / D</th>
                                        <th className="px-4 py-2.5 text-left min-w-[130px]">Win Rate</th>
                                        <th className="px-4 py-2.5 text-right w-14">MVP</th>
                                        <th className="px-4 py-2.5 text-right w-12" title="Gols"><IconRenderer value={resolveIcon(_icons, 'goal')} size={13} /></th>
                                        <th className="px-4 py-2.5 text-right w-12" title="Assistências"><IconRenderer value={resolveIcon(_icons, 'assist')} size={13} /></th>
                                        <th className="px-4 py-2.5 text-right w-12" title="Gols contra"><IconRenderer value={resolveIcon(_icons, 'ownGoal')} size={13} /></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {sorted.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                                                Nenhum jogador encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        sorted.map((p, idx) => {
                                            const wr = normalizeWR(p.winRate);
                                            const color = wrColor(wr);
                                            const inactive = !isActive(p.status);
                                            return (
                                                <tr
                                                    key={p.playerId}
                                                    className={cx(
                                                        "hover:bg-slate-50 cursor-pointer transition-colors",
                                                        inactive && "opacity-50"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedId(p.playerId);
                                                        setMainTab("players");
                                                    }}
                                                >
                                                    {/* Rank */}
                                                    <td className="px-4 py-2.5 text-xs font-mono text-slate-400 tabular-nums">
                                                        {idx + 1}
                                                    </td>

                                                    {/* Name */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            {p.isGoalkeeper && (
                                                                <span className="text-sm leading-none shrink-0" title="Goleiro">
                                                                    <IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={13} />
                                                                </span>
                                                            )}
                                                            <span className="font-semibold text-slate-900 truncate">
                                                                {p.name}
                                                            </span>
                                                            {p.mvps > 0 && (
                                                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={11} lucideProps={{ className: "text-amber-400 shrink-0" }} />
                                                            )}
                                                            {inactive && (
                                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                                    inativo
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Games */}
                                                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                                                        {p.gamesPlayed}
                                                    </td>

                                                    {/* V/E/D */}
                                                    <td className="px-4 py-2.5 text-center tabular-nums text-xs">
                                                        <span className="text-green-600 font-semibold">{p.wins}</span>
                                                        <span className="text-slate-300 mx-0.5">/</span>
                                                        <span className="text-slate-500">{p.ties}</span>
                                                        <span className="text-slate-300 mx-0.5">/</span>
                                                        <span className="text-red-500 font-semibold">{p.losses}</span>
                                                    </td>

                                                    {/* WR */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{ width: `${wr}%`, backgroundColor: color }}
                                                                />
                                                            </div>
                                                            <span
                                                                className="text-xs font-bold tabular-nums w-9 text-right shrink-0"
                                                                style={{ color }}
                                                            >
                                                                {pct(wr)}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* MVPs */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                                        {p.mvps > 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-amber-500 font-semibold text-xs">
                                                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={11} />{p.mvps}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">—</span>
                                                        )}
                                                    </td>

                                                    {/* Goals */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                                        {(p.goals || 0) > 0
                                                            ? <span className="font-semibold text-slate-700">{p.goals}</span>
                                                            : <span className="text-slate-300">—</span>}
                                                    </td>

                                                    {/* Assists */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                                        {(p.assists || 0) > 0
                                                            ? <span className="font-semibold text-slate-700">{p.assists}</span>
                                                            : <span className="text-slate-300">—</span>}
                                                    </td>

                                                    {/* Own goals */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                                        {(p.ownGoals || 0) > 0
                                                            ? <span className="font-semibold text-red-500">{p.ownGoals}</span>
                                                            : <span className="text-slate-300">—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Melhores duplas ──────────────────────────── */}
                    {globalSynergy.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">
                                        Melhores duplas
                                    </span>
                                    <span className="ml-2 text-xs text-slate-400">
                                        {Math.min(globalSynergy.length, 20)} pares · por win rate
                                    </span>
                                </div>
                                <Layers size={14} className="text-slate-400 shrink-0" />
                            </div>

                            <div className="divide-y divide-slate-50">
                                {globalSynergy.slice(0, 20).map((row, idx) => (
                                    <div
                                        key={`${row.aId}|${row.bId}`}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                                    >
                                        {/* Rank */}
                                        <span className="text-xs font-mono text-slate-400 tabular-nums w-5 shrink-0">
                                            {idx + 1}
                                        </span>

                                        {/* Names */}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-slate-900">
                                                {row.aName}
                                            </span>
                                            <span className="text-slate-300 mx-1.5 text-xs">+</span>
                                            <span className="text-sm font-medium text-slate-900">
                                                {row.bName}
                                            </span>
                                        </div>

                                        {/* Matches + wins */}
                                        <span className="text-xs text-slate-400 tabular-nums shrink-0 hidden sm:block">
                                            {row.matches}j · {row.wins}V
                                        </span>

                                        {/* WR bar */}
                                        <div className="w-28 shrink-0">
                                            <WRBar value={row.wr} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PLAYERS TAB
            ══════════════════════════════════════════════════════ */}
            {mainTab === "players" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                    {/* ── Left: player list ────────────────────────── */}
                    <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden">

                        {/* Sidebar toolbar */}
                        <div className="px-3 py-2.5 border-b border-slate-100 space-y-2">
                            {/* Search */}
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                <Search size={13} className="text-slate-400 shrink-0" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar…"
                                    className="w-full bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Sort chips */}
                            <div className="flex items-center gap-1 flex-wrap">
                                {(
                                    [
                                        { k: "winrate",  label: "WR" },
                                        { k: "games",    label: "Jogos" },
                                        { k: "goals",    label: <IconRenderer value={resolveIcon(_icons, 'goal')} size={13} /> },
                                        { k: "assists",  label: <IconRenderer value={resolveIcon(_icons, 'assist')} size={13} /> },
                                        { k: "owngoals", label: <IconRenderer value={resolveIcon(_icons, 'ownGoal')} size={13} /> },
                                        { k: "name",     label: "Nome" },
                                    ] as { k: SortKey; label: React.ReactNode }[]
                                ).map(({ k, label }) => (
                                    <SortChip key={k} active={sortKey === k} dir="desc" onClick={() => setSortKey(k)}>
                                        {label}
                                    </SortChip>
                                ))}
                            </div>
                        </div>

                        {/* Player list */}
                        <div className="max-h-[72vh] overflow-y-auto divide-y divide-slate-50">
                            {sorted.length === 0 && (
                                <div className="px-4 py-6 text-sm text-center text-slate-400">
                                    Nenhum jogador encontrado.
                                </div>
                            )}
                            {sorted.map((p) => {
                                const active = p.playerId === selectedId;
                                const wr = normalizeWR(p.winRate);
                                return (
                                    <button
                                        key={p.playerId}
                                        type="button"
                                        onClick={() => setSelectedId(p.playerId)}
                                        className={cx(
                                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                            active
                                                ? "bg-slate-900"
                                                : "hover:bg-slate-50"
                                        )}
                                    >
                                        {/* Avatar initial */}
                                        <div
                                            className={cx(
                                                "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                                                active
                                                    ? "bg-white/10 text-white"
                                                    : "bg-slate-100 text-slate-600"
                                            )}
                                        >
                                            {p.name[0]?.toUpperCase()}
                                        </div>

                                        {/* Name + sub-info */}
                                        <div className="flex-1 min-w-0">
                                            <div className={cx("text-sm font-semibold truncate", active ? "text-white" : "text-slate-900")}>
                                                {p.isGoalkeeper ? <><IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={13} />{" "}</> : null}{p.name}
                                            </div>
                                            <div className={cx("text-[11px] tabular-nums", active ? "text-slate-400" : "text-slate-400")}>
                                                {p.gamesPlayed}j · {p.wins}V{p.ties}E{p.losses}D
                                            </div>
                                        </div>

                                        {/* WR */}
                                        <span
                                            className="text-xs font-bold tabular-nums shrink-0"
                                            style={{ color: active ? "#fff" : wrColor(wr) }}
                                        >
                                            {pct(wr)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Right: player detail ─────────────────────── */}
                    <div className="lg:col-span-8 space-y-4">
                        {!selectedPlayer ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
                                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                                <div className="text-sm text-slate-400">Selecione um jogador</div>
                            </div>
                        ) : (
                            <>
                                {/* Player header card */}
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    {/* Top strip with player's WR color */}
                                    <div
                                        className="h-1"
                                        style={{ backgroundColor: wrColor(normalizeWR(selectedPlayer.winRate)) }}
                                    />

                                    <div className="px-5 py-4">
                                        {/* Name row */}
                                        <div className="flex items-start gap-3">
                                            {/* Avatar */}
                                            <div className="h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
                                                {selectedPlayer.name[0]?.toUpperCase()}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-900 text-lg leading-none">
                                                        {selectedPlayer.name}
                                                    </span>
                                                    {selectedPlayer.isGoalkeeper && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                                            <Shield size={11} /> Goleiro
                                                        </span>
                                                    )}
                                                    {!isActive(selectedPlayer.status) && (
                                                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                                            Inativo
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Inline stats */}
                                                <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-slate-500">
                                                    <span className="tabular-nums">
                                                        <span className="font-semibold text-slate-700">{selectedPlayer.gamesPlayed}</span> jogos
                                                    </span>
                                                    <span className="text-green-600 tabular-nums font-semibold">
                                                        {selectedPlayer.wins}V
                                                    </span>
                                                    <span className="text-slate-400 tabular-nums">
                                                        {selectedPlayer.ties}E
                                                    </span>
                                                    <span className="text-red-500 tabular-nums font-semibold">
                                                        {selectedPlayer.losses}D
                                                    </span>
                                                    {selectedPlayer.mvps > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                                                            <IconRenderer value={resolveIcon(_icons, 'mvp')} size={11} />{" "}{selectedPlayer.mvps} MVP{selectedPlayer.mvps > 1 ? "s" : ""}
                                                        </span>
                                                    )}
                                                    {(selectedPlayer.goals || 0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
                                                            <IconRenderer value={resolveIcon(_icons, 'goal')} size={12} />{selectedPlayer.goals}
                                                        </span>
                                                    )}
                                                    {(selectedPlayer.assists || 0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
                                                            <IconRenderer value={resolveIcon(_icons, 'assist')} size={12} />{selectedPlayer.assists}
                                                        </span>
                                                    )}
                                                    {(selectedPlayer.ownGoals || 0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 tabular-nums text-red-500">
                                                            <IconRenderer value={resolveIcon(_icons, 'ownGoal')} size={12} />{selectedPlayer.ownGoals} GC
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Big WR */}
                                            <div className="text-right shrink-0">
                                                <div
                                                    className="text-3xl font-extrabold tabular-nums leading-none"
                                                    style={{ color: wrColor(normalizeWR(selectedPlayer.winRate)) }}
                                                >
                                                    {pct(normalizeWR(selectedPlayer.winRate))}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-0.5">
                                                    Win Rate
                                                </div>
                                            </div>
                                        </div>

                                        {/* W/D/L proportion bar */}
                                        <div className="mt-4">
                                            <WDLBar
                                                wins={selectedPlayer.wins}
                                                ties={selectedPlayer.ties}
                                                losses={selectedPlayer.losses}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Synergies card */}
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Layers size={14} className="text-slate-400" />
                                            <span className="text-sm font-semibold text-slate-800">
                                                Sinergias
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {synergies.length} parceiro{synergies.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        {/* Min-together filter */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-xs text-slate-400">Mín.</span>
                                            <select
                                                value={minTogether}
                                                onChange={(e) => setMinTogether(parseInt(e.target.value, 10))}
                                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                                            >
                                                <option value={1}>1+ j</option>
                                                <option value={2}>2+ j</option>
                                                <option value={3}>3+ j</option>
                                                <option value={5}>5+ j</option>
                                                <option value={8}>8+ j</option>
                                            </select>
                                        </div>
                                    </div>

                                    {synergies.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-sm text-slate-400">
                                            Sem sinergias com esse filtro.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50">
                                            {synergies.map((s) => (
                                                <div
                                                    key={s.withPlayerId}
                                                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                                                >
                                                    {/* Partner avatar */}
                                                    <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                        {s.withPlayerName[0]?.toUpperCase()}
                                                    </div>

                                                    {/* Partner name + games */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-slate-900 truncate">
                                                            {s.withPlayerName}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 tabular-nums">
                                                            {s.matchesTogether}j · {s.winsTogether}V
                                                        </div>
                                                    </div>

                                                    {/* WR bar */}
                                                    <div className="w-28 shrink-0">
                                                        <WRBar value={s.wr} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
