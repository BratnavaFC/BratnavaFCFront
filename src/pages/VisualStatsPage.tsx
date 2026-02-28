import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TeamGenApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import {
    Activity,
    BarChart3,
    Medal,
    Search,
    Shield,
    Swords,
    Trophy,
    Users,
    ArrowUpRight,
    User,
    Layers,
} from "lucide-react";

/** =========================
 * DTOs (espelho do backend)
 * ========================= */
type PlayerSynergyItem = {
    withPlayerId: string;
    withPlayerName: string;
    matchesTogether: number;
    winsTogether: number;
    winRateTogether: number; // 0..1 ou 0..100
};

type PlayerVisualStatsItem = {
    playerId: string;
    name: string;

    status: number; // enum Status
    isGoalkeeper: boolean;

    gamesPlayed: number;
    wins: number;
    ties: number;
    losses: number;
    winRate: number; // 0..1 ou 0..100

    mvps: number;

    synergies: PlayerSynergyItem[];
};

type PlayerVisualStatsReport = {
    groupId: string;
    totalMatchesConsidered: number;
    totalFinalizedMatches: number;
    totalMatchesWithScore: number;
    players: PlayerVisualStatsItem[];
};

/** =========================
 * Helpers
 * ========================= */
function classNames(...xs: Array<string | false | undefined | null>) {
    return xs.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function normalizeRateTo0_100(v: number) {
    if (!Number.isFinite(v)) return 0;
    if (v <= 1) return clamp(v * 100, 0, 100);
    return clamp(v, 0, 100);
}

function formatPct(v0to100: number) {
    return `${v0to100.toFixed(0)}%`;
}

function statusLabel(status: number) {
    // ajuste conforme seu enum real
    if (status === 1) return { text: "Ativo", tone: "green" as const };
    if (status === 2) return { text: "Inativo", tone: "slate" as const };
    return { text: `Status ${status}`, tone: "slate" as const };
}

function Badge({
    children,
    tone = "slate",
}: {
    children: React.ReactNode;
    tone?: "slate" | "green" | "blue" | "amber" | "red" | "purple";
}) {
    const map: Record<string, string> = {
        slate: "bg-slate-100 text-slate-700 border-slate-200",
        green: "bg-green-50 text-green-700 border-green-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        amber: "bg-amber-50 text-amber-800 border-amber-200",
        red: "bg-red-50 text-red-700 border-red-200",
        purple: "bg-purple-50 text-purple-700 border-purple-200",
    };

    return (
        <span
            className={classNames(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                map[tone] || map.slate
            )}
        >
            {children}
        </span>
    );
}

function ProgressBar({ value0to100 }: { value0to100: number }) {
    const w = clamp(value0to100, 0, 100);
    return (
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-slate-900" style={{ width: `${w}%` }} />
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    right,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    right?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="text-slate-500">{icon}</div>
                    <div className="text-xs text-slate-600">{label}</div>
                </div>
                {right}
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
        </div>
    );
}

/** =========================
 * Ranking global de sinergias (pares)
 * ========================= */
type GlobalSynergyRow = {
    aId: string;
    aName: string;
    bId: string;
    bName: string;
    matches: number;
    wins: number;
    winRate0to100: number;
};

function buildGlobalSynergy(players: PlayerVisualStatsItem[]): GlobalSynergyRow[] {
    const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
    const map = new Map<string, GlobalSynergyRow>();

    for (const p of players) {
        for (const s of p.synergies || []) {
            if (!s || s.matchesTogether <= 0) continue;

            const k = key(p.playerId, s.withPlayerId);
            const winRate0to100 = normalizeRateTo0_100(s.winRateTogether);

            if (!map.has(k)) {
                const [aId, bId] =
                    p.playerId < s.withPlayerId
                        ? [p.playerId, s.withPlayerId]
                        : [s.withPlayerId, p.playerId];

                const [aName, bName] =
                    p.playerId < s.withPlayerId ? [p.name, s.withPlayerName] : [s.withPlayerName, p.name];

                map.set(k, {
                    aId,
                    aName,
                    bId,
                    bName,
                    matches: s.matchesTogether,
                    wins: s.winsTogether,
                    winRate0to100,
                });
            } else {
                const cur = map.get(k)!;
                if (s.matchesTogether > cur.matches) {
                    cur.matches = s.matchesTogether;
                    cur.wins = s.winsTogether;
                    cur.winRate0to100 = winRate0to100;
                }
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => {
        if (b.winRate0to100 !== a.winRate0to100) return b.winRate0to100 - a.winRate0to100;
        return b.matches - a.matches;
    });
}

/** =========================
 * Tabs
 * ========================= */
type MainTab = "stats" | "players";
type PlayerSubTab = "resumo" | "sinergias";

/** =========================
 * Premium Layout Page
 * ========================= */
export default function VisualStatsPage() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const activeGroupId = useAccountStore((s) => s.getActive()?.activeGroupId);

    // Quando o grupo ativo mudar enquanto o usuário já está nesta página,
    // redireciona para as stats do novo grupo
    useEffect(() => {
        if (activeGroupId && activeGroupId !== groupId) {
            navigate(`/app/groups/${activeGroupId}/visual-stats`, { replace: true });
        }
    }, [activeGroupId, groupId, navigate]);

    const [data, setData] = useState<PlayerVisualStatsReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Tabs
    const [mainTab, setMainTab] = useState<MainTab>("stats");
    const [playerTabId, setPlayerTabId] = useState<string | null>(null);
    const [playerSubTab, setPlayerSubTab] = useState<PlayerSubTab>("resumo");

    // Search / sort
    const [playerSearch, setPlayerSearch] = useState("");
    const [minTogether, setMinTogether] = useState<number>(1); // filtro sinergia
    const [sortPlayers, setSortPlayers] = useState<"name" | "winrate" | "games">("name");

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setLoading(true);
                setErr(null);

                if (!groupId) throw new Error("groupId não encontrado na rota.");

                const res: any = await TeamGenApi.visualStats(groupId);
                const payload: PlayerVisualStatsReport = res?.data ?? res;

                if (!mounted) return;

                setData(payload);

                const sorted = [...(payload.players ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
                setPlayerTabId(sorted[0]?.playerId ?? null);
            } catch (e: any) {
                if (!mounted) return;
                setErr(e?.message || "Falha ao carregar visual stats.");
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [groupId]);

    const players = data?.players ?? [];

    const header = useMemo(() => {
        const totalPlayers = players.length;
        const totalGamesPlayed = players.reduce((acc, p) => acc + (p.gamesPlayed || 0), 0);
        const totalMvps = players.reduce((acc, p) => acc + (p.mvps || 0), 0);
        return { totalPlayers, totalGamesPlayed, totalMvps };
    }, [players]);

    const playersFilteredSorted = useMemo(() => {
        const q = playerSearch.trim().toLowerCase();
        let list = [...players];

        if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

        if (sortPlayers === "name") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        if (sortPlayers === "winrate")
            list.sort((a, b) => normalizeRateTo0_100(b.winRate) - normalizeRateTo0_100(a.winRate));
        if (sortPlayers === "games") list.sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0));

        return list;
    }, [players, playerSearch, sortPlayers]);

    const selectedPlayer = useMemo(() => {
        if (!playerTabId) return null;
        return players.find((p) => p.playerId === playerTabId) ?? null;
    }, [players, playerTabId]);

    const selectedSynergies = useMemo(() => {
        if (!selectedPlayer) return [];
        return (selectedPlayer.synergies ?? [])
            .map((s) => ({
                ...s,
                winRateTogether0to100: normalizeRateTo0_100(s.winRateTogether),
            }))
            .filter((s) => s.matchesTogether >= (minTogether || 1))
            .sort((a, b) => {
                if (b.winRateTogether0to100 !== a.winRateTogether0to100)
                    return b.winRateTogether0to100 - a.winRateTogether0to100;
                return b.matchesTogether - a.matchesTogether;
            });
    }, [selectedPlayer, minTogether]);

    const globalSynergy = useMemo(() => buildGlobalSynergy(players), [players]);

    /** =========================
     * Loading / Error
     * ========================= */
    if (loading) {
        return (
            <div className="p-4">
                <div className="text-slate-700">Carregando visual stats…</div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="p-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{err}</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-4">
                <div className="text-slate-700">Nenhum dado retornado.</div>
            </div>
        );
    }

    /** =========================
     * UI
     * ========================= */
    return (
        <div className="p-4 space-y-3">
            {/* Header (compacto) */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="text-xs text-slate-600">Bratnava FC • Visual Stats</div>
                    <h1 className="text-xl font-bold text-slate-900">Estatísticas</h1>
                    <div className="mt-0.5 text-xs text-slate-500">
                        GroupId: <span className="font-mono">{data.groupId}</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">
                        <Users size={14} /> {header.totalPlayers} jogadores
                    </Badge>
                    <Badge>
                        <Activity size={14} /> soma jogos: {header.totalGamesPlayed}
                    </Badge>
                    <Badge tone="purple">
                        <Medal size={14} /> MVPs: {header.totalMvps}
                    </Badge>
                </div>
            </div>

            {/* Tabs principais (compactas) */}
            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMainTab("stats")}
                        className={classNames(
                            "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold border",
                            mainTab === "stats"
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <span className="inline-flex items-center gap-2 justify-center">
                            <BarChart3 size={16} /> Estatísticas
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMainTab("players")}
                        className={classNames(
                            "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold border",
                            mainTab === "players"
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <span className="inline-flex items-center gap-2 justify-center">
                            <Users size={16} /> Jogadores
                        </span>
                    </button>
                </div>
            </div>

            {mainTab === "stats" ? (
                /** =========================
                 * STATS (layout premium 2 colunas)
                 * ========================= */
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {/* Coluna esquerda: KPIs + lista rápida */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            <StatCard
                                icon={<Activity size={16} />}
                                label="Consideradas"
                                value={data.totalMatchesConsidered}
                            />
                            <StatCard icon={<Trophy size={16} />} label="Finalizadas" value={data.totalFinalizedMatches} />
                            <StatCard icon={<Swords size={16} />} label="Com placar" value={data.totalMatchesWithScore} />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-900">Jogadores (resumo)</div>
                                <button
                                    type="button"
                                    onClick={() => setMainTab("players")}
                                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
                                >
                                    Abrir <ArrowUpRight size={14} />
                                </button>
                            </div>

                            <div className="mt-2 space-y-1.5">
                                {players
                                    .slice()
                                    .sort((a, b) => normalizeRateTo0_100(b.winRate) - normalizeRateTo0_100(a.winRate))
                                    .slice(0, 10)
                                    .map((p) => {
                                        const wr = normalizeRateTo0_100(p.winRate);
                                        return (
                                            <button
                                                key={p.playerId}
                                                type="button"
                                                onClick={() => {
                                                    setMainTab("players");
                                                    setPlayerTabId(p.playerId);
                                                    setPlayerSubTab("resumo");
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-2 text-left"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                                                            {p.mvps > 0 ? (
                                                                <Badge tone="purple">
                                                                    <Medal size={14} /> {p.mvps}
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-[11px] text-slate-600">
                                                            {p.gamesPlayed} jogos • V/E/D {p.wins}/{p.ties}/{p.losses}
                                                        </div>
                                                    </div>

                                                    <div className="w-28 flex-shrink-0">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[11px] text-slate-600">WR</div>
                                                            <div className="text-xs font-semibold text-slate-900">{formatPct(wr)}</div>
                                                        </div>
                                                        <div className="mt-1">
                                                            <ProgressBar value0to100={wr} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* Coluna central/direita: ranking global de sinergia */}
                    <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Ranking global de sinergias</div>
                                <div className="text-xs text-slate-600">
                                    Top pares por WinRate (desempate por jogos juntos)
                                </div>
                            </div>
                            <Badge tone="blue">
                                <Layers size={14} /> {Math.min(globalSynergy.length, 50)} pares
                            </Badge>
                        </div>

                        {/* Tabela densa */}
                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-slate-600">
                                    <tr className="border-b border-slate-200">
                                        <th className="py-2 pr-2 w-10">#</th>
                                        <th className="py-2 pr-2">Dupla</th>
                                        <th className="py-2 pr-2 w-28">Jogos</th>
                                        <th className="py-2 pr-2 w-28">Vitórias</th>
                                        <th className="py-2 pr-2 w-40">WinRate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {globalSynergy.slice(0, 20).map((row, idx) => (
                                        <tr key={`${row.aId}|${row.bId}`} className="hover:bg-slate-50">
                                            <td className="py-2 pr-2 text-xs text-slate-500">{idx + 1}</td>
                                            <td className="py-2 pr-2">
                                                <div className="font-semibold text-slate-900">
                                                    {row.aName} <span className="text-slate-400">+</span> {row.bName}
                                                </div>
                                            </td>
                                            <td className="py-2 pr-2 text-slate-700">{row.matches}</td>
                                            <td className="py-2 pr-2 text-slate-700">{row.wins}</td>
                                            <td className="py-2 pr-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-28">
                                                        <ProgressBar value0to100={row.winRate0to100} />
                                                    </div>
                                                    <div className="text-xs font-semibold text-slate-900">
                                                        {formatPct(row.winRate0to100)}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {globalSynergy.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-sm text-slate-700">
                                                Nenhum dado de sinergia disponível.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
                            Dica: clique em um jogador no resumo para abrir a aba <b>Jogadores</b>.
                        </div>
                    </div>
                </div>
            ) : (
                /** =========================
                 * PLAYERS (layout premium: lista lateral + detalhe)
                 * ========================= */
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                    {/* Left: lista de jogadores */}
                    <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">Jogadores</div>
                            <div className="text-xs text-slate-600">{playersFilteredSorted.length} itens</div>
                        </div>

                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <Search size={16} className="text-slate-500" />
                            <input
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                placeholder="Buscar… (ex: Caio)"
                                className="w-full bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-slate-600">Ordenar</label>
                            <select
                                value={sortPlayers}
                                onChange={(e) => setSortPlayers(e.target.value as any)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                            >
                                <option value="name">Nome</option>
                                <option value="winrate">WinRate</option>
                                <option value="games">Jogos</option>
                            </select>
                        </div>

                        <div className="mt-3 max-h-[70vh] overflow-auto pr-1">
                            <div className="space-y-1.5">
                                {playersFilteredSorted.map((p) => {
                                    const active = p.playerId === playerTabId;
                                    const wr = normalizeRateTo0_100(p.winRate);
                                    const st = statusLabel(p.status);

                                    return (
                                        <button
                                            key={p.playerId}
                                            type="button"
                                            onClick={() => {
                                                setPlayerTabId(p.playerId);
                                                setPlayerSubTab("resumo");
                                            }}
                                            className={classNames(
                                                "w-full rounded-lg border px-2.5 py-2 text-left",
                                                active
                                                    ? "border-slate-900 bg-slate-900 text-white"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className={classNames("font-semibold truncate", active ? "text-white" : "text-slate-900")}>
                                                        {p.name}
                                                    </div>
                                                    <div className={classNames("text-[11px]", active ? "text-slate-200" : "text-slate-600")}>
                                                        {p.gamesPlayed} jogos • V/E/D {p.wins}/{p.ties}/{p.losses}
                                                    </div>
                                                </div>

                                                <div className="w-20 flex-shrink-0">
                                                    <div className={classNames("text-[11px] text-right", active ? "text-slate-200" : "text-slate-600")}>
                                                        {formatPct(wr)}
                                                    </div>
                                                    <div className="mt-1">
                                                        {/* barra mais fina */}
                                                        <div className={classNames("h-1.5 w-full rounded-full overflow-hidden", active ? "bg-slate-700" : "bg-slate-200")}>
                                                            <div className={classNames("h-full", active ? "bg-white" : "bg-slate-900")} style={{ width: `${wr}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {p.isGoalkeeper ? (
                                                    <span className={classNames("text-[11px] rounded-full border px-2 py-0.5",
                                                        active ? "border-slate-700 bg-slate-800 text-white" : "border-amber-200 bg-amber-50 text-amber-800")}>
                                                        <span className="inline-flex items-center gap-1"><Shield size={12} /> GK</span>
                                                    </span>
                                                ) : null}

                                                <span className={classNames("text-[11px] rounded-full border px-2 py-0.5",
                                                    active ? "border-slate-700 bg-slate-800 text-white" :
                                                        st.tone === "green" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-100 text-slate-700"
                                                )}>
                                                    {st.text}
                                                </span>

                                                {p.mvps > 0 ? (
                                                    <span className={classNames("text-[11px] rounded-full border px-2 py-0.5",
                                                        active ? "border-slate-700 bg-slate-800 text-white" : "border-purple-200 bg-purple-50 text-purple-700")}>
                                                        <span className="inline-flex items-center gap-1"><Medal size={12} /> {p.mvps}</span>
                                                    </span>
                                                ) : null}
                                            </div>
                                        </button>
                                    );
                                })}

                                {playersFilteredSorted.length === 0 ? (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                        Nenhum jogador encontrado.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Right: detalhe do jogador */}
                    <div className="lg:col-span-8 space-y-3">
                        {!selectedPlayer ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm">
                                Selecione um jogador na lista.
                            </div>
                        ) : (
                            <>
                                {/* Header compacto do jogador */}
                                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="text-lg font-bold text-slate-900 truncate">{selectedPlayer.name}</div>
                                                {selectedPlayer.isGoalkeeper ? (
                                                    <Badge tone="amber">
                                                        <Shield size={14} /> Goleiro
                                                    </Badge>
                                                ) : null}
                                                <Badge tone={statusLabel(selectedPlayer.status).tone}>
                                                    {statusLabel(selectedPlayer.status).text}
                                                </Badge>
                                                {selectedPlayer.mvps > 0 ? (
                                                    <Badge tone="purple">
                                                        <Medal size={14} /> {selectedPlayer.mvps} MVP
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <div className="mt-0.5 text-sm text-slate-600">
                                                {selectedPlayer.gamesPlayed} jogos • V/E/D:{" "}
                                                <b className="text-slate-900">
                                                    {selectedPlayer.wins}/{selectedPlayer.ties}/{selectedPlayer.losses}
                                                </b>
                                            </div>
                                        </div>

                                        <div className="w-full sm:w-80">
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-slate-600">WinRate</div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {formatPct(normalizeRateTo0_100(selectedPlayer.winRate))}
                                                </div>
                                            </div>
                                            <div className="mt-1">
                                                <ProgressBar value0to100={normalizeRateTo0_100(selectedPlayer.winRate)} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subtabs (compactas) */}
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPlayerSubTab("resumo")}
                                                className={classNames(
                                                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold border",
                                                    playerSubTab === "resumo"
                                                        ? "bg-slate-900 text-white border-slate-900"
                                                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                <span className="inline-flex items-center gap-2 justify-center">
                                                    <User size={16} /> Resumo
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPlayerSubTab("sinergias")}
                                                className={classNames(
                                                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold border",
                                                    playerSubTab === "sinergias"
                                                        ? "bg-slate-900 text-white border-slate-900"
                                                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                <span className="inline-flex items-center gap-2 justify-center">
                                                    <Layers size={16} /> Sinergias
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Conteúdo do detalhe */}
                                {playerSubTab === "resumo" ? (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <StatCard icon={<Activity size={16} />} label="Jogos" value={selectedPlayer.gamesPlayed} />
                                        <StatCard icon={<Trophy size={16} />} label="Vitórias" value={selectedPlayer.wins} />
                                        <StatCard icon={<Swords size={16} />} label="Empates" value={selectedPlayer.ties} />
                                        <StatCard icon={<Swords size={16} />} label="Derrotas" value={selectedPlayer.losses} />

                                        <div className="sm:col-span-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                            <div className="text-sm font-semibold text-slate-900">Resumo textual</div>
                                            <div className="mt-2 text-sm text-slate-700">
                                                <b>{selectedPlayer.name}</b>:{" "}
                                                <b className="text-slate-900">{selectedPlayer.gamesPlayed}</b> jogos,{" "}
                                                <b className="text-slate-900">{selectedPlayer.wins}</b> vitórias,{" "}
                                                <b className="text-slate-900">{selectedPlayer.ties}</b> empates,{" "}
                                                <b className="text-slate-900">{selectedPlayer.losses}</b> derrotas, WinRate{" "}
                                                <b className="text-slate-900">{formatPct(normalizeRateTo0_100(selectedPlayer.winRate))}</b>
                                                {selectedPlayer.mvps > 0 ? (
                                                    <>
                                                        {" "}
                                                        • MVPs: <b className="text-slate-900">{selectedPlayer.mvps}</b>
                                                    </>
                                                ) : null}
                                                .
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    Sinergias de {selectedPlayer.name}
                                                </div>
                                                <div className="text-xs text-slate-600">
                                                    Ordenado por WinRate juntos, depois jogos juntos
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-slate-600">Mín. jogos juntos</label>
                                                <select
                                                    value={minTogether}
                                                    onChange={(e) => setMinTogether(parseInt(e.target.value || "1", 10))}
                                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                                                >
                                                    <option value={1}>1+</option>
                                                    <option value={2}>2+</option>
                                                    <option value={3}>3+</option>
                                                    <option value={5}>5+</option>
                                                    <option value={8}>8+</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Tabela densa de sinergias */}
                                        <div className="mt-3 overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="text-xs text-slate-600">
                                                    <tr className="border-b border-slate-200">
                                                        <th className="py-2 pr-2">Com</th>
                                                        <th className="py-2 pr-2 w-24">Jogos</th>
                                                        <th className="py-2 pr-2 w-24">Vitórias</th>
                                                        <th className="py-2 pr-2 w-44">WinRate</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {selectedSynergies.map((s) => (
                                                        <tr key={`${selectedPlayer.playerId}-${s.withPlayerId}`} className="hover:bg-slate-50">
                                                            <td className="py-2 pr-2">
                                                                <div className="font-semibold text-slate-900">{s.withPlayerName}</div>
                                                                <div className="text-[11px] text-slate-600">
                                                                    {selectedPlayer.name} ↔ {s.withPlayerName}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 pr-2 text-slate-700">{s.matchesTogether}</td>
                                                            <td className="py-2 pr-2 text-slate-700">{s.winsTogether}</td>
                                                            <td className="py-2 pr-2">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-28">
                                                                        <ProgressBar value0to100={s.winRateTogether0to100} />
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-slate-900">
                                                                        {formatPct(s.winRateTogether0to100)}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {selectedSynergies.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-4 text-sm text-slate-700">
                                                                Sem sinergias com o filtro atual.
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}