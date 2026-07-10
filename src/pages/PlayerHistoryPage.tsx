import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MatchesApi, PlayersApi, TeamGenApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { useGroupIcons } from "../hooks/useGroupIcons";
import { resolveIcon } from "../lib/groupIcons";
import { IconRenderer } from "../components/IconRenderer";
import { CalendarDays, ChevronRight, MapPin, Search, X } from "lucide-react";
import { toUtcDate } from "../utils/dateUtils";

/* ===================== Types ===================== */

type PlayerOption = { id: string; name: string; isGoalkeeper: boolean };

type MatchItem = {
    matchId: string;
    playedAt: string;
    teamAGoals: number;
    teamBGoals: number;
    statusName: string;
    placeName?: string | null;
    teamAColorHex?: string | null;
    teamAColorName?: string | null;
    teamBColorHex?: string | null;
    teamBColorName?: string | null;
    playerTeam: number;
    playerGoals: number;
    playerAssists: number;
    playerOwnGoals: number;
    isPlayerMvp: boolean;
};

/* ===================== Helpers ===================== */

function cx(...xs: Array<string | false | undefined | null>) {
    return xs.filter(Boolean).join(" ");
}

function getResult(item: MatchItem): "W" | "D" | "L" | "?" {
    const { teamAGoals, teamBGoals, playerTeam } = item;
    if (teamAGoals == null || teamBGoals == null) return "?";
    if (teamAGoals === teamBGoals) return "D";
    const aWon = teamAGoals > teamBGoals;
    if ((playerTeam === 1 && aWon) || (playerTeam === 2 && !aWon)) return "W";
    return "L";
}

function resultLabel(r: "W" | "D" | "L" | "?") {
    if (r === "W") return "V";
    if (r === "D") return "E";
    if (r === "L") return "D";
    return "?";
}

function resultClass(r: "W" | "D" | "L" | "?") {
    if (r === "W") return "bg-green-500 text-white";
    if (r === "D") return "bg-slate-400 dark:bg-slate-600 text-white";
    if (r === "L") return "bg-red-500 text-white";
    return "bg-slate-300 dark:bg-slate-700 text-white";
}

function fmtDate(iso: string) {
    const d = toUtcDate(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtShortDate(iso: string) {
    const d = toUtcDate(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getYear(iso: string) {
    return toUtcDate(iso).getFullYear();
}

function TeamColorDot({ hex, name }: { hex?: string | null; name?: string | null }) {
    if (!hex) return <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 inline-block" />;
    return (
        <span
            className="h-3 w-3 rounded-full shrink-0 inline-block border border-black/10"
            style={{ backgroundColor: hex }}
            title={name ?? undefined}
        />
    );
}

/* ===================== Summary Card ===================== */

function SummaryCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
    return (
        <div className="bg-white/10 rounded-xl px-4 py-3 text-center min-w-[64px]">
            <div className="text-2xl font-black tabular-nums leading-none text-white">{value}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/60 mt-1 font-semibold">{label}</div>
            {sub && <div className="text-xs text-white/50 mt-0.5">{sub}</div>}
        </div>
    );
}

/* ===================== Match Card ===================== */

function MatchCard({
    item,
    groupId,
    icons,
    onNavigate,
}: {
    item: MatchItem;
    groupId: string;
    icons: import('../lib/groupIcons').GroupIconConfig | null;
    onNavigate: (matchId: string) => void;
}) {
    const result = getResult(item);
    const myScore = item.playerTeam === 1 ? item.teamAGoals : item.teamBGoals;
    const oppScore = item.playerTeam === 1 ? item.teamBGoals : item.teamAGoals;
    const myColorHex = item.playerTeam === 1 ? item.teamAColorHex : item.teamBColorHex;
    const myColorName = item.playerTeam === 1 ? item.teamAColorName : item.teamBColorName;
    const oppColorHex = item.playerTeam === 1 ? item.teamBColorHex : item.teamAColorHex;
    const oppColorName = item.playerTeam === 1 ? item.teamBColorName : item.teamAColorName;

    return (
        <button
            type="button"
            onClick={() => onNavigate(item.matchId)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
        >
            {/* Date column */}
            <div className="w-12 shrink-0 text-center">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {fmtShortDate(item.playedAt)}
                </div>
                <div className="text-[10px] text-slate-300 dark:text-slate-600 tabular-nums">
                    {getYear(item.playedAt)}
                </div>
            </div>

            {/* Result badge */}
            <div className={cx("w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-black", resultClass(result))}>
                {resultLabel(result)}
            </div>

            {/* Score + colors */}
            <div className="flex items-center gap-1.5 shrink-0">
                <TeamColorDot hex={myColorHex} name={myColorName} />
                <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {myScore} – {oppScore}
                </span>
                <TeamColorDot hex={oppColorHex} name={oppColorName} />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {item.playerGoals > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <IconRenderer value={resolveIcon(icons, 'goal')} size={12} />
                        {item.playerGoals}
                    </span>
                )}
                {item.playerAssists > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <IconRenderer value={resolveIcon(icons, 'assist')} size={12} />
                        {item.playerAssists}
                    </span>
                )}
                {item.playerOwnGoals > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
                        <IconRenderer value={resolveIcon(icons, 'ownGoal')} size={12} />
                        {item.playerOwnGoals}
                    </span>
                )}
                {item.isPlayerMvp && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                        <IconRenderer value={resolveIcon(icons, 'mvp')} size={12} />
                        MVP
                    </span>
                )}
                {item.placeName && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        <MapPin size={9} />
                        {item.placeName}
                    </span>
                )}
            </div>

            <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
        </button>
    );
}

/* ===================== Page ===================== */

export default function PlayerHistoryPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const [searchParams] = useSearchParams();
    const preselectedPlayerId = searchParams.get("playerId");
    const navigate = useNavigate();
    const active = useAccountStore((s) => s.getActive());
    const userId = active?.userId;
    const activeGroupId = active?.activeGroupId;
    const activePlayerId = active?.activePlayerId;
    const resolvedGroupId = groupId ?? activeGroupId ?? "";
    const isGroupAdm = useAccountStore((s) => {
        const acc = s.getActive();
        if (!acc) return false;
        const roles = acc.roles ?? [];
        if (roles.includes("Admin") || roles.includes("GodMode")) return true;
        const gid = groupId ?? acc.activeGroupId ?? "";
        return acc.groupAdminIds?.includes(gid) ?? false;
    });

    const _icons = useGroupIcons(resolvedGroupId);

    // Players list (for admin selector)
    const [players, setPlayers] = useState<PlayerOption[]>([]);
    // Initialize from URL param → own player from store → null
    // This ensures loadHistory fires immediately without waiting for async init()
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
        preselectedPlayerId ?? activePlayerId ?? null
    );
    const [selectedPlayerName, setSelectedPlayerName] = useState<string>("");

    // Match data
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Filters
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [playerSearch, setPlayerSearch] = useState("");

    // Load player list (admins see all; non-admins only own player)
    useEffect(() => {
        if (!resolvedGroupId || !userId) return;

        async function init() {
            setLoadingPlayers(true);
            try {
                if (isGroupAdm) {
                    // Admins: load all active players for the selector
                    const statsRes: any = await TeamGenApi.visualStats(resolvedGroupId);
                    const payload = statsRes?.data?.data ?? statsRes?.data ?? statsRes;
                    const allPlayers: PlayerOption[] = (payload?.players ?? []).map((p: any) => ({
                        id: p.playerId,
                        name: p.name,
                        isGoalkeeper: p.isGoalkeeper,
                    }));
                    allPlayers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
                    setPlayers(allPlayers);

                    // Resolve which player to show:
                    // 1. preselectedPlayerId from URL (e.g. coming from VisualStats)
                    // 2. activePlayerId from store (own player)
                    // 3. first in list
                    const target = preselectedPlayerId ?? activePlayerId ?? null;
                    const found = target ? allPlayers.find(p => p.id === target) : null;
                    const defaultPlayer = found ?? allPlayers[0] ?? null;
                    if (defaultPlayer) {
                        setSelectedPlayerId(defaultPlayer.id);
                        setSelectedPlayerName(defaultPlayer.name);
                    }
                } else {
                    // Non-admins: selectedPlayerId already initialized from activePlayerId.
                    // Just resolve the player name for display.
                    if (activePlayerId) {
                        try {
                            const mineRes: any = await PlayersApi.mine();
                            const mine: any[] = mineRes?.data?.data ?? mineRes?.data ?? [];
                            const myPlayer = mine.find((p: any) => p.id === activePlayerId);
                            if (myPlayer) setSelectedPlayerName(myPlayer.name);
                        } catch { /* name stays empty — history still loads */ }
                    }
                }
            } catch {
                // selectedPlayerId is already initialized from preselectedPlayerId or activePlayerId
                // so history will still load even if the player list fails
            } finally {
                setLoadingPlayers(false);
            }
        }
        init();
    }, [resolvedGroupId, userId, isGroupAdm, activePlayerId, preselectedPlayerId]);

    // Load match history when player changes
    const loadHistory = useCallback(async (playerId: string, year?: number) => {
        if (!resolvedGroupId || !playerId) return;
        setLoading(true);
        setErr(null);
        try {
            const res: any = await MatchesApi.playerHistory(resolvedGroupId, playerId, year);
            const data: any[] = res?.data?.data ?? res?.data ?? [];
            setMatches(data.map((m: any) => ({
                matchId: m.matchId,
                playedAt: m.playedAt,
                teamAGoals: m.teamAGoals,
                teamBGoals: m.teamBGoals,
                statusName: m.statusName,
                placeName: m.placeName,
                teamAColorHex: m.teamAColorHex,
                teamAColorName: m.teamAColorName,
                teamBColorHex: m.teamBColorHex,
                teamBColorName: m.teamBColorName,
                playerTeam: m.playerTeam,
                playerGoals: m.playerGoals,
                playerAssists: m.playerAssists,
                playerOwnGoals: m.playerOwnGoals,
                isPlayerMvp: m.isPlayerMvp,
            })));
        } catch {
            setErr("Erro ao carregar histórico.");
        } finally {
            setLoading(false);
        }
    }, [resolvedGroupId]);

    useEffect(() => {
        if (selectedPlayerId) {
            setSelectedYear(null);
            loadHistory(selectedPlayerId);
        }
    }, [selectedPlayerId, loadHistory]);

    // Available years from loaded matches
    const years = useMemo(() => {
        const set = new Set<number>();
        matches.forEach(m => set.add(getYear(m.playedAt)));
        return Array.from(set).sort((a, b) => b - a);
    }, [matches]);

    // Filtered matches
    const filtered = useMemo(() => {
        let list = matches;
        if (selectedYear) list = list.filter(m => getYear(m.playedAt) === selectedYear);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(m =>
                (m.placeName ?? "").toLowerCase().includes(q) ||
                fmtDate(m.playedAt).toLowerCase().includes(q)
            );
        }
        return list;
    }, [matches, selectedYear, search]);

    // Stats for filtered view
    const stats = useMemo(() => {
        const wins = filtered.filter(m => getResult(m) === "W").length;
        const draws = filtered.filter(m => getResult(m) === "D").length;
        const losses = filtered.filter(m => getResult(m) === "L").length;
        const goals = filtered.reduce((s, m) => s + m.playerGoals, 0);
        const assists = filtered.reduce((s, m) => s + m.playerAssists, 0);
        const mvps = filtered.filter(m => m.isPlayerMvp).length;
        return { total: filtered.length, wins, draws, losses, goals, assists, mvps };
    }, [filtered]);

    // Filtered player list for the selector search
    const filteredPlayers = useMemo(() => {
        if (!playerSearch.trim()) return players;
        const q = playerSearch.trim().toLowerCase();
        return players.filter(p => p.name.toLowerCase().includes(q));
    }, [players, playerSearch]);

    function handleNavigate(matchId: string) {
        navigate(`/app/history/${resolvedGroupId}/${matchId}`);
    }

    // Group matches by month
    const groupedByMonth = useMemo(() => {
        const map = new Map<string, MatchItem[]>();
        for (const m of filtered) {
            const d = toUtcDate(m.playedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(m);
        }
        return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
    }, [filtered]);

    function monthLabel(key: string) {
        const [y, m] = key.split("-");
        const d = new Date(Number(y), Number(m) - 1, 1);
        return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }

    /* ── Render ── */
    if (loadingPlayers) {
        return (
            <div className="space-y-4">
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
        );
    }

    if (!selectedPlayerId && !loadingPlayers && !preselectedPlayerId && !activePlayerId) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Você não tem jogador cadastrado neste grupo.
            </div>
        );
    }

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                <div className="relative">
                    {/* Title row */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="page-header-icon">
                            <CalendarDays size={18} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black leading-tight">Histórico do Jogador</h1>
                            {selectedPlayerName && (
                                <p className="text-xs text-white/60 mt-0.5">{selectedPlayerName}</p>
                            )}
                        </div>
                    </div>

                    {/* Player selector (admin only) */}
                    {isGroupAdm && players.length > 1 && (
                        <div className="mb-4">
                            <div className="relative">
                                <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
                                    <Search size={13} className="text-white/50 shrink-0" />
                                    <input
                                        value={playerSearch}
                                        onChange={e => setPlayerSearch(e.target.value)}
                                        placeholder="Buscar jogador…"
                                        className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                                    />
                                    {playerSearch && (
                                        <button type="button" onClick={() => setPlayerSearch("")} className="text-white/40 hover:text-white/70 shrink-0">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {playerSearch && filteredPlayers.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-20 max-h-48 overflow-y-auto">
                                        {filteredPlayers.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPlayerId(p.id);
                                                    setSelectedPlayerName(p.name);
                                                    setPlayerSearch("");
                                                }}
                                                className={cx(
                                                    "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors",
                                                    p.id === selectedPlayerId ? "text-amber-400 font-semibold" : "text-white"
                                                )}
                                            >
                                                {p.name}
                                                {p.isGoalkeeper && <span className="ml-2 text-[10px] text-slate-400">GK</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Quick player chips (show top ~10 sorted) */}
                            {!playerSearch && (
                                <div className="mt-2 flex gap-1.5 flex-wrap">
                                    {players.slice(0, 12).map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => { setSelectedPlayerId(p.id); setSelectedPlayerName(p.name); }}
                                            className={cx(
                                                "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                                                p.id === selectedPlayerId
                                                    ? "bg-white text-slate-900 border-white"
                                                    : "bg-transparent text-white/70 border-white/30 hover:bg-white/10"
                                            )}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                    {players.length > 12 && (
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSearch(" ")}
                                            className="px-2.5 py-1 rounded-full text-xs font-semibold border border-white/20 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                                        >
                                            +{players.length - 12} mais
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stats summary */}
                    {!loading && filtered.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            <SummaryCard label="Jogos" value={stats.total} />
                            <SummaryCard label="V" value={<span className="text-green-400">{stats.wins}</span>} />
                            <SummaryCard label="E" value={<span className="text-slate-400">{stats.draws}</span>} />
                            <SummaryCard label="D" value={<span className="text-red-400">{stats.losses}</span>} />
                            {stats.total > 0 && (
                                <SummaryCard
                                    label="Win %"
                                    value={`${Math.round((stats.wins / stats.total) * 100)}%`}
                                />
                            )}
                            {(stats.goals > 0 || stats.assists > 0) && (
                                <SummaryCard
                                    label="Gols"
                                    value={<span className="inline-flex items-center gap-1"><IconRenderer value={resolveIcon(_icons, 'goal')} size={16} />{stats.goals}</span>}
                                />
                            )}
                            {stats.assists > 0 && (
                                <SummaryCard
                                    label="Assists"
                                    value={<span className="inline-flex items-center gap-1"><IconRenderer value={resolveIcon(_icons, 'assist')} size={16} />{stats.assists}</span>}
                                />
                            )}
                            {stats.mvps > 0 && (
                                <SummaryCard
                                    label="MVPs"
                                    value={<span className="inline-flex items-center gap-1 text-amber-400"><IconRenderer value={resolveIcon(_icons, 'mvp')} size={16} />{stats.mvps}</span>}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Year filter tabs + search ── */}
            {matches.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    {/* Year tabs */}
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setSelectedYear(null)}
                            className={cx(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                                !selectedYear
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                        >
                            Todos
                        </button>
                        {years.map(y => (
                            <button
                                key={y}
                                type="button"
                                onClick={() => setSelectedYear(y)}
                                className={cx(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                                    selectedYear === y
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                            >
                                {y}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 flex-1 min-w-[140px] max-w-xs">
                        <Search size={13} className="text-slate-400 shrink-0" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Local ou data…"
                            className="w-full bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 shrink-0">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-300">
                    {err}
                </div>
            )}

            {loading && (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !err && filtered.length === 0 && selectedPlayerId && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    Nenhuma partida encontrada{selectedYear ? ` em ${selectedYear}` : ""}.
                </div>
            )}

            {!loading && !err && groupedByMonth.length > 0 && (
                <div className="space-y-4">
                    {groupedByMonth.map(([monthKey, items]) => (
                        <div key={monthKey} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                            {/* Month header */}
                            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 capitalize">
                                    {monthLabel(monthKey)}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                                    {items.length} partida{items.length !== 1 ? "s" : ""}
                                </span>
                            </div>

                            {/* Match rows */}
                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                {items.map(item => (
                                    <MatchCard
                                        key={item.matchId}
                                        item={item}
                                        groupId={resolvedGroupId}
                                        icons={_icons}
                                        onNavigate={handleNavigate}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
