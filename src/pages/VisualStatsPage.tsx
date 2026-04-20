import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TeamGenApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import {
    BarChart3,
    ChevronDown,
    ChevronUp,
    Layers,
    Search,
    Shield,
    X,
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
    /** Assists the selected player gave to this partner */
    assistsGiven?: number;
    /** Assists this partner gave to the selected player */
    assistsReceived?: number;
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

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

/* ===================== Sub-components ===================== */

/** Horizontal W / E / D proportional bar */
function WDLBar({ wins, ties, losses }: { wins: number; ties: number; losses: number }) {
    const total = wins + ties + losses;
    if (total === 0) return <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800" />;
    const wPct = (wins / total) * 100;
    const tPct = (ties / total) * 100;
    const lPct = (losses / total) * 100;
    return (
        <div className="flex h-2 w-full rounded-full overflow-hidden gap-px bg-slate-100 dark:bg-slate-800">
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
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color }}>
                {pct(value)}
            </span>
        </div>
    );
}

/** Medal or position number for leaderboard rows */
function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <span className="text-base leading-none select-none">🥇</span>;
    if (rank === 2) return <span className="text-base leading-none select-none">🥈</span>;
    if (rank === 3) return <span className="text-base leading-none select-none">🥉</span>;
    return <span className="text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums">{rank}</span>;
}

/** Stat pill for the player detail modal */
function StatPill({
    label,
    value,
    color = "text-slate-900 dark:text-white",
    icon,
}: {
    label: string;
    value: number | string;
    color?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 text-center">
            {icon && <div className="flex justify-center mb-1 text-slate-400">{icon}</div>}
            <div className={cx("text-2xl font-black tabular-nums leading-none", color)}>{value}</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1 font-semibold">{label}</div>
        </div>
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
                    ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
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

type SortKey = "winrate" | "wins" | "games" | "mvps" | "goals" | "assists" | "owngoals" | "name";
type SynergySortKey = "wr" | "wins" | "assistsReceived" | "assistsGiven";

export default function VisualStatsPage() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const active = useAccountStore((s) => s.getActive());
    const activeGroupId = active?.activeGroupId;
    const _icons = useGroupIcons(groupId ?? activeGroupId);

    useEffect(() => {
        navigate("/app", { replace: true });
    }, [navigate]);

    const [data, setData] = useState<PlayerVisualStatsReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("winrate");
    const [minTogether, setMinTogether] = useState(1);
    const [synergySortKey, setSynergySortKey] = useState<SynergySortKey>("wr");

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

    const MIN_GAMES_WR = 3;

    const sorted = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = players.filter(p => isActive(p.status));
        if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
        if (sortKey === "winrate") {
            list.sort((a, b) => {
                const aValid = a.gamesPlayed >= MIN_GAMES_WR;
                const bValid = b.gamesPlayed >= MIN_GAMES_WR;
                if (aValid !== bValid) return aValid ? -1 : 1;
                return normalizeWR(b.winRate) - normalizeWR(a.winRate);
            });
        }
        else if (sortKey === "wins")     list.sort((a, b) => (b.wins || 0) - (a.wins || 0));
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
        const list = (selectedPlayer.synergies ?? [])
            .map((s) => ({ ...s, wr: normalizeWR(s.winRateTogether) }))
            .filter((s) => s.matchesTogether >= minTogether);
        if (synergySortKey === "wins")
            list.sort((a, b) => b.winsTogether !== a.winsTogether ? b.winsTogether - a.winsTogether : b.matchesTogether - a.matchesTogether);
        else if (synergySortKey === "assistsReceived")
            list.sort((a, b) => (b.assistsReceived ?? 0) - (a.assistsReceived ?? 0));
        else if (synergySortKey === "assistsGiven")
            list.sort((a, b) => (b.assistsGiven ?? 0) - (a.assistsGiven ?? 0));
        else
            list.sort((a, b) => b.wr !== a.wr ? b.wr - a.wr : b.matchesTogether - a.matchesTogether);
        return list;
    }, [selectedPlayer, minTogether, synergySortKey]);

    const globalSynergy = useMemo(() => buildGlobalSynergy(players), [players]);

    /** Competition-style ranking: players with identical values share the same rank,
     *  and the next rank skips taken positions (1, 1, 1, 4). */
    const sortedRanks = useMemo(() => {
        const ranks = new Map<string, number>();
        const getValue = (p: PlayerVisualStatsItem): number | string => {
            switch (sortKey) {
                case "winrate":  return p.gamesPlayed < MIN_GAMES_WR ? -Infinity : normalizeWR(p.winRate);
                case "wins":     return p.wins || 0;
                case "games":    return p.gamesPlayed || 0;
                case "mvps":     return p.mvps || 0;
                case "goals":    return p.goals || 0;
                case "assists":  return p.assists || 0;
                case "owngoals": return p.ownGoals || 0;
                case "name":     return p.name;
                default:         return 0;
            }
        };
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
            if (i === 0) {
                ranks.set(sorted[0].playerId, 1);
            } else {
                const tied = getValue(sorted[i]) === getValue(sorted[i - 1]);
                ranks.set(sorted[i].playerId, tied ? ranks.get(sorted[i - 1].playerId)! : (rank = i + 1));
            }
        }
        return ranks;
    }, [sorted, sortKey, MIN_GAMES_WR]);

    /* ── Loading ── */
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-6 w-40 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-4 w-64 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
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
        return <div className="text-sm text-slate-500 dark:text-slate-400">Nenhum dado retornado.</div>;
    }

    /* ── UI ── */
    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                {/* Title + subtitle */}
                <div className="relative flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        <BarChart3 size={26} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-tight">Estatísticas</h1>
                        <p className="text-sm text-white/50 mt-0.5">
                            {players.filter(p => isActive(p.status)).length} jogadores ativos
                            {data.totalFinalizedMatches > 0 && <> · {data.totalFinalizedMatches} partidas finalizadas</>}
                            {data.totalMatchesConsidered > 0 && <> · {data.totalMatchesConsidered} consideradas</>}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="space-y-6">

                    {/* ── Player ranking table ─────────────────────── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">

                        {/* Table toolbar */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 shrink-0">
                                Ranking de jogadores
                            </span>

                            {/* Search */}
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 flex-1 min-w-[150px] max-w-xs">
                                <Search size={13} className="text-slate-400 shrink-0" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar jogador…"
                                    className="w-full bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                                {search && (
                                    <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0 transition-colors">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Sort chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {(
                                    [
                                        { k: "winrate",  label: "Win Rate" },
                                        { k: "wins",     label: "Vitórias" },
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

                        {/* ── Mobile card list (hidden on sm+) ── */}
                        <div className="sm:hidden">
                            {sorted.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                                    Nenhum jogador encontrado.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {sorted.map((p, idx) => {
                                        const wr = normalizeWR(p.winRate);
                                        const color = wrColor(wr);
                                        return (
                                            <div
                                                key={p.playerId}
                                                className="flex items-start gap-3 px-4 py-3 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                                                onClick={() => setSelectedId(p.playerId)}
                                            >
                                                {/* Rank */}
                                                <div className="w-6 shrink-0 flex justify-center pt-0.5">
                                                    <RankBadge rank={sortedRanks.get(p.playerId) ?? idx + 1} />
                                                </div>

                                                {/* Player info */}
                                                <div className="flex-1 min-w-0">
                                                    {/* Name */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {p.isGoalkeeper && (
                                                            <span className="shrink-0">
                                                                <IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={12} />
                                                            </span>
                                                        )}
                                                        <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                                            {p.name}
                                                        </span>
                                                        {p.mvps > 0 && (
                                                            <IconRenderer value={resolveIcon(_icons, 'mvp')} size={11} lucideProps={{ className: "text-amber-400 shrink-0" }} />
                                                        )}
                                                    </div>

                                                    {/* WR bar */}
                                                    <div className="mt-1.5">
                                                        {p.gamesPlayed < MIN_GAMES_WR ? (
                                                            <span className="text-xs text-slate-300 dark:text-slate-600">
                                                                — <span className="text-[10px]">(&lt;{MIN_GAMES_WR}j)</span>
                                                            </span>
                                                        ) : (
                                                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{ width: `${wr}%`, backgroundColor: color }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Stats row */}
                                                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                                                        <span>{p.gamesPlayed}j</span>
                                                        <span className="text-slate-200 dark:text-slate-700">·</span>
                                                        <span>
                                                            <span className="text-green-600 font-semibold">{p.wins}V</span>
                                                            {" "}
                                                            <span>{p.ties}E</span>
                                                            {" "}
                                                            <span className="text-red-500 font-semibold">{p.losses}D</span>
                                                        </span>
                                                        {(p.goals || 0) > 0 && (
                                                            <>
                                                                <span className="text-slate-200 dark:text-slate-700">·</span>
                                                                <span className="inline-flex items-center gap-0.5 font-medium text-slate-700 dark:text-slate-300">
                                                                    <IconRenderer value={resolveIcon(_icons, 'goal')} size={10} />{p.goals}
                                                                </span>
                                                            </>
                                                        )}
                                                        {(p.assists || 0) > 0 && (
                                                            <>
                                                                <span className="text-slate-200 dark:text-slate-700">·</span>
                                                                <span className="inline-flex items-center gap-0.5 font-medium text-slate-700 dark:text-slate-300">
                                                                    <IconRenderer value={resolveIcon(_icons, 'assist')} size={10} />{p.assists}
                                                                </span>
                                                            </>
                                                        )}
                                                        {(p.ownGoals || 0) > 0 && (
                                                            <>
                                                                <span className="text-slate-200 dark:text-slate-700">·</span>
                                                                <span className="font-medium text-red-500">GC {p.ownGoals}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* WR value */}
                                                {p.gamesPlayed >= MIN_GAMES_WR && (
                                                    <div className="shrink-0 font-bold text-sm tabular-nums" style={{ color }}>
                                                        {pct(wr)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Desktop table (hidden on mobile) ── */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
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
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {sorted.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                                                Nenhum jogador encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        sorted.map((p, idx) => {
                                            const wr = normalizeWR(p.winRate);
                                            const color = wrColor(wr);
                                            return (
                                                <tr
                                                    key={p.playerId}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedId(p.playerId)}
                                                >
                                                    {/* Rank */}
                                                    <td className="px-4 py-2.5 text-center">
                                                        <RankBadge rank={sortedRanks.get(p.playerId) ?? idx + 1} />
                                                    </td>

                                                    {/* Name */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            {p.isGoalkeeper && (
                                                                <span className="text-sm leading-none shrink-0" title="Goleiro">
                                                                    <IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={13} />
                                                                </span>
                                                            )}
                                                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                                                                {p.name}
                                                            </span>
                                                            {p.mvps > 0 && (
                                                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={11} lucideProps={{ className: "text-amber-400 shrink-0" }} />
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Games */}
                                                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                                                        {p.gamesPlayed}
                                                    </td>

                                                    {/* V/E/D */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="text-center tabular-nums text-xs mb-1.5">
                                                            <span className="text-green-600 font-semibold">{p.wins}</span>
                                                            <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
                                                            <span className="text-slate-500 dark:text-slate-400">{p.ties}</span>
                                                            <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
                                                            <span className="text-red-500 font-semibold">{p.losses}</span>
                                                        </div>
                                                        <WDLBar wins={p.wins} ties={p.ties} losses={p.losses} />
                                                    </td>

                                                    {/* WR (mínimo 3 jogos) */}
                                                    <td className="px-4 py-2.5">
                                                        {p.gamesPlayed < MIN_GAMES_WR ? (
                                                            <span className="text-xs text-slate-300 dark:text-slate-600">— <span className="text-[10px]">(&lt;{MIN_GAMES_WR}j)</span></span>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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
                                                        )}
                                                    </td>

                                                    {/* MVPs */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                                        {p.mvps > 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-amber-500 font-semibold text-xs">
                                                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={11} />{p.mvps}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                                                        )}
                                                    </td>

                                                    {/* Goals */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                                        {(p.goals || 0) > 0
                                                            ? <span className="font-semibold text-slate-700 dark:text-slate-300">{p.goals}</span>
                                                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                    </td>

                                                    {/* Assists */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                                        {(p.assists || 0) > 0
                                                            ? <span className="font-semibold text-slate-700 dark:text-slate-300">{p.assists}</span>
                                                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                    </td>

                                                    {/* Own goals */}
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                                        {(p.ownGoals || 0) > 0
                                                            ? <span className="font-semibold text-red-500">{p.ownGoals}</span>
                                                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
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
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                                <div>
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Melhores duplas
                                    </span>
                                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                                        {Math.min(globalSynergy.length, 20)} pares · por win rate
                                    </span>
                                </div>
                                <Layers size={14} className="text-slate-400 shrink-0" />
                            </div>

                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                {globalSynergy.slice(0, 20).map((row, idx) => (
                                    <div
                                        key={`${row.aId}|${row.bId}`}
                                        className="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        {/* Rank + Avatars (always inline) */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="w-6 flex justify-center">
                                                <RankBadge rank={idx + 1} />
                                            </div>
                                            <div className="flex -space-x-2 shrink-0">
                                                <div className="h-7 w-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-extrabold text-[10px] ring-2 ring-white dark:ring-slate-900 select-none z-10">
                                                    {initials(row.aName)}
                                                </div>
                                                <div className="h-7 w-7 rounded-lg bg-slate-600 dark:bg-slate-300 text-white dark:text-slate-900 flex items-center justify-center font-extrabold text-[10px] ring-2 ring-white dark:ring-slate-900 select-none">
                                                    {initials(row.bName)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Names + WR: stacked on mobile, side-by-side on sm+ */}
                                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline flex-wrap gap-x-1 min-w-0">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                        {row.aName}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-slate-600 text-xs font-bold shrink-0">+</span>
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                        {row.bName}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                                                    {row.matches}j · <span className="text-green-600 dark:text-green-500">{row.wins}V</span>
                                                </div>
                                            </div>
                                            {/* WR bar: full-width on mobile, fixed on sm+ */}
                                            <div className="w-full sm:w-32 shrink-0">
                                                <WRBar value={row.wr} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            {/* ── Player detail modal ── */}
            {selectedPlayer && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setSelectedId(null)}
                >
                    <div
                        className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header sticky */}
                        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 pt-3 pb-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                            <div className="sm:hidden w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">
                                {selectedPlayer.name}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedId(null)}
                                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Player header card */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="h-1" style={{ backgroundColor: wrColor(normalizeWR(selectedPlayer.winRate)) }} />
                                <div className="px-5 py-4">
                                    {/* Top row: avatar + name + WR */}
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-extrabold text-sm shrink-0 select-none">
                                            {initials(selectedPlayer.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                                                    {selectedPlayer.name}
                                                </span>
                                                {selectedPlayer.isGoalkeeper && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                                        <Shield size={10} /> Goleiro
                                                    </span>
                                                )}
                                                {!isActive(selectedPlayer.status) && (
                                                    <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                        Inativo
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
                                            <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                                                Win Rate
                                            </div>
                                        </div>
                                    </div>

                                    {/* WDL proportional bar */}
                                    <div className="mt-4">
                                        <WDLBar wins={selectedPlayer.wins} ties={selectedPlayer.ties} losses={selectedPlayer.losses} />
                                    </div>

                                    {/* Stat pills grid */}
                                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                                        <StatPill label="Jogos" value={selectedPlayer.gamesPlayed} />
                                        <StatPill label="Vitórias" value={selectedPlayer.wins} color="text-green-600 dark:text-green-500" />
                                        <StatPill label="Empates" value={selectedPlayer.ties} color="text-slate-500 dark:text-slate-400" />
                                        <StatPill label="Derrotas" value={selectedPlayer.losses} color="text-red-500" />
                                        <StatPill
                                            label="MVPs"
                                            value={selectedPlayer.mvps || 0}
                                            color={selectedPlayer.mvps > 0 ? "text-amber-500" : "text-slate-400 dark:text-slate-600"}
                                            icon={<IconRenderer value={resolveIcon(_icons, 'mvp')} size={13} lucideProps={{ className: "text-amber-400" }} />}
                                        />
                                        <StatPill
                                            label="Gols"
                                            value={selectedPlayer.goals || 0}
                                            color={(selectedPlayer.goals || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-600"}
                                            icon={<IconRenderer value={resolveIcon(_icons, 'goal')} size={13} />}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Synergies card */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Layers size={14} className="text-slate-400 dark:text-slate-500" />
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sinergias</span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                                {synergies.length} parceiro{synergies.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-xs text-slate-400 dark:text-slate-500">Mín.</span>
                                            <select
                                                value={minTogether}
                                                onChange={(e) => setMinTogether(parseInt(e.target.value, 10))}
                                                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white px-2 py-1 text-xs outline-none"
                                            >
                                                <option value={1}>1+ j</option>
                                                <option value={2}>2+ j</option>
                                                <option value={3}>3+ j</option>
                                                <option value={5}>5+ j</option>
                                                <option value={8}>8+ j</option>
                                            </select>
                                        </div>
                                    </div>
                                    {/* Sort chips */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {([
                                            { k: "wr",              label: "Win Rate" },
                                            { k: "wins",            label: "Vitórias" },
                                            { k: "assistsReceived", label: <><IconRenderer value={resolveIcon(_icons, 'assist')} size={12} /> Assist. recebidas</> },
                                            { k: "assistsGiven",    label: <><IconRenderer value={resolveIcon(_icons, 'assist')} size={12} /> Assist. dadas</> },
                                        ] as { k: SynergySortKey; label: React.ReactNode }[]).map(({ k, label }) => (
                                            <SortChip key={k} active={synergySortKey === k} dir="desc" onClick={() => setSynergySortKey(k)}>
                                                {label}
                                            </SortChip>
                                        ))}
                                    </div>
                                </div>

                                {synergies.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                                        Sem sinergias com esse filtro.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {synergies.map((s) => {
                                            const hasAssists = (s.assistsReceived ?? 0) > 0 || (s.assistsGiven ?? 0) > 0;
                                            return (
                                                <div key={s.withPlayerId} className="flex items-center gap-3 px-4 py-3">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-extrabold text-xs shrink-0 select-none">
                                                        {initials(s.withPlayerName)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.withPlayerName}</div>
                                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums flex flex-wrap gap-x-2 mt-0.5">
                                                            <span>{s.matchesTogether}j · <span className="text-green-600 dark:text-green-500">{s.winsTogether}V</span></span>
                                                            {hasAssists && (
                                                                <>
                                                                    <span className="text-slate-300 dark:text-slate-700">·</span>
                                                                    <span>
                                                                        <IconRenderer value={resolveIcon(_icons, 'assist')} size={11} />
                                                                        {" "}recebidas{" "}
                                                                        <span className="font-semibold text-slate-600 dark:text-slate-300">{s.assistsReceived ?? 0}</span>
                                                                        {" · "}dadas{" "}
                                                                        <span className="font-semibold text-slate-600 dark:text-slate-300">{s.assistsGiven ?? 0}</span>
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="w-28 shrink-0">
                                                        <WRBar value={s.wr} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
