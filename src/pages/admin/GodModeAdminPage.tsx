import React, { useEffect, useState } from "react";
import { Section } from "../../components/Section";
import { GroupsApi, PlayersApi, MatchesApi, TeamColorApi } from "../../api/endpoints";
import {
    ChevronDown,
    ChevronRight,
    Trash2,
    Loader2,
    Users,
    CalendarDays,
    Palette,
    Search,
    AlertTriangle,
} from "lucide-react";

// ── Tipos locais ──────────────────────────────────────────────────────────────

type PlayerDto = {
    id: string;
    name: string;
    userId: string | null;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
};

type GroupDto = {
    id: string;
    name: string;
    scheduleMatchDate: string | null;
    adminIds: string[];
    status: number;
    players: PlayerDto[];
};

type MatchItem = {
    matchId: string;
    status: number;
    statusName?: string;
    placeName?: string | null;
    playedAt?: string | null;
};

type ColorItem = {
    id: string;
    name: string;
    hexValue: string;
    isActive: boolean;
};

type Tab = "players" | "matches" | "colors";

type LazyData = {
    matches?: MatchItem[];
    colors?: ColorItem[];
    loadingMatches?: boolean;
    loadingColors?: boolean;
};

type ConfirmState = {
    label: string;
    onConfirm: () => Promise<void>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: number) {
    return status === 2 ? (
        <span className="pill bg-slate-100 text-slate-500 text-xs">Inativo</span>
    ) : (
        <span className="pill bg-green-100 text-green-700 text-xs">Ativo</span>
    );
}

function matchStatusLabel(status: number) {
    const labels: Record<number, string> = {
        1: "Criada",
        2: "Aceitação",
        3: "Matchmaking",
        4: "Em jogo",
        5: "Encerrada",
        6: "Pós-jogo",
        7: "Finalizada",
    };
    return labels[status] ?? `Status ${status}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function GodModeAdminPage() {
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Record<string, Tab>>({});
    const [lazy, setLazy] = useState<Record<string, LazyData>>({});
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Carregar todos os grupos ──────────────────────────────────────────────

    useEffect(() => {
        GroupsApi.listAll()
            .then((res) => setGroups(res.data ?? []))
            .catch(() => setError("Erro ao carregar grupos."))
            .finally(() => setLoading(false));
    }, []);

    // ── Expandir grupo e lazy-load de partidas/cores ──────────────────────────

    function toggleExpand(groupId: string) {
        if (expandedId === groupId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(groupId);
        if (!activeTab[groupId]) {
            setActiveTab((prev) => ({ ...prev, [groupId]: "players" }));
        }
    }

    async function loadMatches(groupId: string) {
        if (lazy[groupId]?.matches !== undefined) return;
        setLazy((prev) => ({ ...prev, [groupId]: { ...prev[groupId], loadingMatches: true } }));
        try {
            const res = await MatchesApi.list(groupId);
            const items: MatchItem[] = Array.isArray(res.data) ? res.data : [];
            setLazy((prev) => ({
                ...prev,
                [groupId]: { ...prev[groupId], matches: items, loadingMatches: false },
            }));
        } catch {
            setLazy((prev) => ({
                ...prev,
                [groupId]: { ...prev[groupId], matches: [], loadingMatches: false },
            }));
        }
    }

    async function loadColors(groupId: string) {
        if (lazy[groupId]?.colors !== undefined) return;
        setLazy((prev) => ({ ...prev, [groupId]: { ...prev[groupId], loadingColors: true } }));
        try {
            const res = await TeamColorApi.list(groupId);
            const items: ColorItem[] = Array.isArray(res.data) ? res.data : [];
            setLazy((prev) => ({
                ...prev,
                [groupId]: { ...prev[groupId], colors: items, loadingColors: false },
            }));
        } catch {
            setLazy((prev) => ({
                ...prev,
                [groupId]: { ...prev[groupId], colors: [], loadingColors: false },
            }));
        }
    }

    function switchTab(groupId: string, tab: Tab) {
        setActiveTab((prev) => ({ ...prev, [groupId]: tab }));
        if (tab === "matches") loadMatches(groupId);
        if (tab === "colors") loadColors(groupId);
    }

    // ── Confirmação ───────────────────────────────────────────────────────────

    function askConfirm(label: string, action: () => Promise<void>) {
        setConfirm({ label, onConfirm: action });
    }

    async function runConfirm() {
        if (!confirm) return;
        setConfirmLoading(true);
        try {
            await confirm.onConfirm();
        } finally {
            setConfirmLoading(false);
            setConfirm(null);
        }
    }

    // ── Ações de exclusão ─────────────────────────────────────────────────────

    function deleteGroup(group: GroupDto) {
        askConfirm(`Excluir grupo "${group.name}"?`, async () => {
            await GroupsApi.remove(group.id);
            setGroups((prev) => prev.filter((g) => g.id !== group.id));
            if (expandedId === group.id) setExpandedId(null);
        });
    }

    function deletePlayer(groupId: string, player: PlayerDto) {
        askConfirm(`Excluir jogador "${player.name}"?`, async () => {
            await PlayersApi.remove(player.id);
            setGroups((prev) =>
                prev.map((g) =>
                    g.id === groupId
                        ? { ...g, players: g.players.filter((p) => p.id !== player.id) }
                        : g
                )
            );
        });
    }

    function deleteMatch(groupId: string, match: MatchItem) {
        askConfirm(`Excluir partida "${match.placeName ?? match.matchId.slice(0, 8)}"?`, async () => {
            await MatchesApi.remove(groupId, match.matchId);
            setLazy((prev) => ({
                ...prev,
                [groupId]: {
                    ...prev[groupId],
                    matches: (prev[groupId]?.matches ?? []).filter((m) => m.matchId !== match.matchId),
                },
            }));
        });
    }

    function deleteColor(groupId: string, color: ColorItem) {
        askConfirm(`Excluir cor "${color.name}"?`, async () => {
            await TeamColorApi.remove(groupId, color.id);
            setLazy((prev) => ({
                ...prev,
                [groupId]: {
                    ...prev[groupId],
                    colors: (prev[groupId]?.colors ?? []).filter((c) => c.id !== color.id),
                },
            }));
        });
    }

    // ── Filtro de grupos ──────────────────────────────────────────────────────

    const filtered = groups.filter((g) =>
        g.name.toLowerCase().includes(search.toLowerCase())
    );

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="animate-spin text-slate-400" size={28} />
            </div>
        );
    }

    return (
        <div className="p-4 max-w-4xl mx-auto space-y-4">
            <Section title="Painel GodMode">
                <p className="text-sm text-slate-500 mb-3">
                    Visão completa do sistema. Todos os grupos, jogadores, partidas e cores.
                </p>

                {/* Search */}
                <div className="relative mb-4">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="input pl-9 w-full"
                        placeholder="Filtrar grupos..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500 mb-3">{error}</p>
                )}

                {filtered.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">Nenhum grupo encontrado.</p>
                )}

                {/* Lista de grupos */}
                <div className="space-y-2">
                    {filtered.map((group) => {
                        const groupId = group.id;
                        const isOpen = expandedId === groupId;
                        const tab = activeTab[groupId] ?? "players";
                        const lazyData = lazy[groupId] ?? {};

                        return (
                            <div key={groupId} className="card overflow-hidden">
                                {/* Cabeçalho do grupo */}
                                <div
                                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50"
                                    onClick={() => toggleExpand(groupId)}
                                >
                                    <span className="text-slate-400">
                                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </span>
                                    <span className="flex-1 font-medium text-sm">{group.name}</span>
                                    {statusBadge(group.status)}
                                    <span className="text-xs text-slate-400">
                                        {group.players.length} jogador(es)
                                    </span>
                                    <button
                                        className="btn btn-danger py-1 px-2 text-xs"
                                        onClick={(e) => { e.stopPropagation(); deleteGroup(group); }}
                                        title="Excluir grupo"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                {/* Conteúdo expandido */}
                                {isOpen && (
                                    <div className="border-t">
                                        {/* Tabs */}
                                        <div className="flex border-b bg-slate-50 text-xs">
                                            {(["players", "matches", "colors"] as Tab[]).map((t) => {
                                                const icons: Record<Tab, React.ReactNode> = {
                                                    players: <Users size={13} />,
                                                    matches: <CalendarDays size={13} />,
                                                    colors: <Palette size={13} />,
                                                };
                                                const labels: Record<Tab, string> = {
                                                    players: "Jogadores",
                                                    matches: "Partidas",
                                                    colors: "Cores",
                                                };
                                                return (
                                                    <button
                                                        key={t}
                                                        onClick={() => switchTab(groupId, t)}
                                                        className={[
                                                            "flex items-center gap-1 px-4 py-2 border-b-2 transition",
                                                            tab === t
                                                                ? "border-slate-900 text-slate-900 font-medium"
                                                                : "border-transparent text-slate-500 hover:text-slate-700",
                                                        ].join(" ")}
                                                    >
                                                        {icons[t]} {labels[t]}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Tab: Jogadores */}
                                        {tab === "players" && (
                                            <div className="p-3 space-y-1">
                                                {group.players.length === 0 && (
                                                    <p className="text-xs text-slate-400 text-center py-4">
                                                        Sem jogadores.
                                                    </p>
                                                )}
                                                {group.players.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50"
                                                    >
                                                        <span className="flex-1 text-sm">{p.name}</span>
                                                        {p.isGuest && (
                                                            <span className="pill bg-yellow-100 text-yellow-700 text-xs">Guest</span>
                                                        )}
                                                        {p.isGoalkeeper && (
                                                            <span className="pill bg-blue-100 text-blue-700 text-xs">GK</span>
                                                        )}
                                                        {statusBadge(p.status)}
                                                        <span className="text-xs text-slate-400 w-8 text-right">
                                                            {p.skillPoints}pts
                                                        </span>
                                                        <button
                                                            className="btn btn-danger py-0.5 px-1.5 text-xs"
                                                            onClick={() => deletePlayer(groupId, p)}
                                                            title="Excluir jogador"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tab: Partidas */}
                                        {tab === "matches" && (
                                            <div className="p-3 space-y-1">
                                                {lazyData.loadingMatches ? (
                                                    <div className="flex justify-center py-4">
                                                        <Loader2 className="animate-spin text-slate-400" size={18} />
                                                    </div>
                                                ) : (lazyData.matches ?? []).length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-4">
                                                        Sem partidas.
                                                    </p>
                                                ) : (
                                                    (lazyData.matches ?? []).map((m) => (
                                                        <div
                                                            key={m.matchId}
                                                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50"
                                                        >
                                                            <span className="flex-1 text-sm">
                                                                {m.placeName ?? "Sem local"}{" "}
                                                                {m.playedAt
                                                                    ? `· ${new Date(m.playedAt).toLocaleDateString("pt-BR")}`
                                                                    : ""}
                                                            </span>
                                                            <span className="pill bg-slate-100 text-slate-600 text-xs">
                                                                {m.statusName ?? matchStatusLabel(m.status)}
                                                            </span>
                                                            <button
                                                                className="btn btn-danger py-0.5 px-1.5 text-xs"
                                                                onClick={() => deleteMatch(groupId, m)}
                                                                title="Excluir partida"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {/* Tab: Cores */}
                                        {tab === "colors" && (
                                            <div className="p-3 space-y-1">
                                                {lazyData.loadingColors ? (
                                                    <div className="flex justify-center py-4">
                                                        <Loader2 className="animate-spin text-slate-400" size={18} />
                                                    </div>
                                                ) : (lazyData.colors ?? []).length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-4">
                                                        Sem cores.
                                                    </p>
                                                ) : (
                                                    (lazyData.colors ?? []).map((c) => (
                                                        <div
                                                            key={c.id}
                                                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50"
                                                        >
                                                            <span
                                                                className="w-5 h-5 rounded-full border border-slate-200 shrink-0"
                                                                style={{ background: c.hexValue }}
                                                            />
                                                            <span className="flex-1 text-sm">{c.name}</span>
                                                            <span className="text-xs text-slate-400 font-mono">{c.hexValue}</span>
                                                            {!c.isActive && (
                                                                <span className="pill bg-slate-100 text-slate-500 text-xs">Inativa</span>
                                                            )}
                                                            <button
                                                                className="btn btn-danger py-0.5 px-1.5 text-xs"
                                                                onClick={() => deleteColor(groupId, c)}
                                                                title="Excluir cor"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* Modal de confirmação */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="card p-6 w-full max-w-sm space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 text-red-600">
                            <AlertTriangle size={22} />
                            <span className="font-semibold text-base">Confirmar exclusão</span>
                        </div>
                        <p className="text-sm text-slate-700">{confirm.label}</p>
                        <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2 justify-end">
                            <button
                                className="btn py-1.5 px-4 text-sm"
                                onClick={() => setConfirm(null)}
                                disabled={confirmLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-danger py-1.5 px-4 text-sm flex items-center gap-2"
                                onClick={runConfirm}
                                disabled={confirmLoading}
                            >
                                {confirmLoading && <Loader2 size={14} className="animate-spin" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
