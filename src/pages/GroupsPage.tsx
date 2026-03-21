// src/pages/GroupsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Section } from "../components/Section";
import { AddGuestModal } from "../components/modals/AddGuestModal";
import { InviteModal } from "../components/modals/InviteModal";
import { LeaveConfirmModal } from "../components/modals/LeaveConfirmModal";
import { EditPlayerModal } from "../components/modals/EditPlayerModal";
import { CreatorLeaveModal } from "../components/modals/CreatorLeaveModal";
import { GroupsApi, PaymentsApi, PlayersApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, LogOut, Pencil, Plus, UserPlus, Users2, X } from "lucide-react";
import { isGodMode, isGroupFinanceiro } from "../auth/guards";
import { useGroupIcons } from "../hooks/useGroupIcons";
import { IconRenderer } from "../components/IconRenderer";
import { resolveIcon } from "../lib/groupIcons";

// ─── DTOs ────────────────────────────────────────────────────────────────────

type PlayerDto = {
    id: string;
    userId?: string | null;
    userName?: string | null;
    name: string;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
    guestStarRating?: number | null;
};


type GroupDto = {
    id: string;
    name: string;
    adminIds: string[];
    players: PlayerDto[];
    createdByUserId: string;
};

type MyPlayerItem = {
    playerId: string;
    userId?: string | null;
    groupId: string;
    playerName: string;
    isGoalkeeper: boolean;
    skillPoints: number;
    status: number;
    groupName: string;
    isGuest: boolean;
};

// ─── GroupsPage ──────────────────────────────────────────────────────────────

export default function GroupsPage() {
    const isGroupAdmin = useAccountStore((s) => s.isGroupAdmin);
    const active = useAccountStore((s) => s.getActive());
    const currentUserId = active?.userId ?? "";
    const isGod = isGodMode();

    // ── Estado: lista de patotas do usuário ──
    const [myPlayers, setMyPlayers] = useState<MyPlayerItem[]>([]);
    const [mineLoading, setMineLoading] = useState(true);

    // ── Estado: grupo expandido ──
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [group, setGroup] = useState<GroupDto | null>(null);
    const [groupLoading, setGroupLoading] = useState(false);
    const [groupError, setGroupError] = useState<string | null>(null);

    // payment badges: playerId → { pendingMonths, pendingExtras }
    const [paymentMap, setPaymentMap] = useState<Map<string, { pendingMonths: number; pendingExtras: number }>>(new Map());

    // ── Estado: modais ──
    const [inviteOpen, setInviteOpen] = useState(false);
    const [addGuestOpen, setAddGuestOpen] = useState(false);
    const [editPlayer, setEditPlayer] = useState<PlayerDto | null>(null);
    const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const [creatorLeaveOpen, setCreatorLeaveOpen] = useState(false);

    // ── Grupos únicos do usuário (sem repetição) ──
    const myGroups = useMemo(() => {
        const seen = new Set<string>();
        return myPlayers.filter(p => {
            if (seen.has(p.groupId)) return false;
            seen.add(p.groupId);
            return true;
        }).map(p => ({ groupId: p.groupId, groupName: p.groupName }));
    }, [myPlayers]);

    // ── Derivados do grupo expandido ──
    const myPlayerInExpandedGroup = expandedGroupId
        ? myPlayers.find(p => p.groupId === expandedGroupId) ?? null
        : null;
    const activePlayerId = myPlayerInExpandedGroup?.playerId ?? "";
    const isAdminOfGroup = isGroupAdmin(expandedGroupId ?? "");
    const isFinanceiroOfGroup = isGroupFinanceiro(expandedGroupId ?? "");

    // ── Icons ligados ao grupo expandido ──
    const _icons = useGroupIcons(expandedGroupId || null);

    // ── Players derivados do grupo expandido ──
    const activePlayers = group?.players?.filter((p) => p.status === 1 && !p.isGuest) ?? [];
    const guestPlayers = group?.players?.filter((p) => p.status === 1 && p.isGuest) ?? [];
    const inactivePlayers = (isAdminOfGroup || isGod)
        ? (group?.players?.filter((p) => p.status !== 1) ?? [])
        : [];

    const sortedPlayers = useMemo(() =>
        [...activePlayers].sort((a, b) => {
            if (a.id === activePlayerId) return -1;
            if (b.id === activePlayerId) return 1;
            return 0;
        }),
        [activePlayers, activePlayerId]);

    const existingUserIds = new Set(
        (group?.players ?? []).filter((p) => !p.isGuest).map((p) => p.userId).filter((id): id is string => !!id)
    );

    // ── Funções ──
    function loadMine() {
        setMineLoading(true);
        return PlayersApi.mine()
            .then(res => setMyPlayers((res.data.data as MyPlayerItem[]) ?? []))
            .catch(() => setMyPlayers([]))
            .finally(() => setMineLoading(false));
    }

    function openGroup(groupId: string) {
        setExpandedGroupId(groupId);
        setGroupLoading(true);
        setGroupError(null);
        setGroup(null);
        GroupsApi.get(groupId)
            .then(res => setGroup(res.data.data as GroupDto))
            .catch(() => setGroupError("Não foi possível carregar os dados da patota."))
            .finally(() => setGroupLoading(false));
    }

    function loadGroup() {
        if (expandedGroupId) openGroup(expandedGroupId);
    }

    function toggleGroup(groupId: string) {
        if (expandedGroupId === groupId) {
            setExpandedGroupId(null);
            setGroup(null);
        } else {
            openGroup(groupId);
        }
    }

    async function loadPaymentData() {
        if (!expandedGroupId) { setPaymentMap(new Map()); return; }
        if (!isGroupFinanceiro(expandedGroupId) && !isGodMode()) {
            setPaymentMap(new Map());
            return;
        }
        const year = new Date().getFullYear();
        try {
            const [gridRes, extraRes] = await Promise.all([
                PaymentsApi.getMonthlyGrid(expandedGroupId, year),
                PaymentsApi.getExtraCharges(expandedGroupId),
            ]);
            const grid: any = gridRes.data.data;
            const extras: any[] = extraRes.data.data! ?? [];
            const hasMonthlyFee = !!(grid?.monthlyFee && grid.monthlyFee > 0);
            const now = new Date();
            const currentMonth = now.getMonth() + 1;

            const map = new Map<string, { pendingMonths: number; pendingExtras: number }>();
            for (const row of (grid?.players ?? []) as any[]) {
                const joinedYear = row.joinedYear ?? 0;
                const joinedMonth = row.joinedMonth ?? 1;
                const pendingMonths = hasMonthlyFee
                    ? ((row.months ?? []) as any[]).filter((c: any) => {
                        if (c.month > currentMonth) return false;
                        if (joinedYear === year && c.month < joinedMonth) return false;
                        return c.status === 0;
                    }).length
                    : 0;
                map.set(row.playerId, { pendingMonths, pendingExtras: 0 });
            }
            for (const charge of extras) {
                if (charge.isCancelled) continue;
                for (const payment of (charge.payments ?? []) as any[]) {
                    if (payment.status !== 0) continue;
                    const entry = map.get(payment.playerId);
                    if (entry) entry.pendingExtras += 1;
                    else map.set(payment.playerId, { pendingMonths: 0, pendingExtras: 1 });
                }
            }
            setPaymentMap(new Map(map));
        } catch {
            // silencioso
        }
    }

    // Carregar mine ao montar
    useEffect(() => { loadMine(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Carregar payment badges quando grupo muda
    useEffect(() => { loadPaymentData(); }, [expandedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-expandir quando 1 grupo
    useEffect(() => {
        if (myGroups.length === 1) {
            openGroup(myGroups[0].groupId);
        }
    }, [myGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleLeave() {
        if (!activePlayerId) return;
        try {
            await PlayersApi.leaveGroup(activePlayerId);
            setLeaveConfirmOpen(false);
            await loadMine();
            loadGroup();
        } catch {
            // silencioso
        }
    }

    // ── Conteúdo dos jogadores (reutilizado em 1 grupo e accordion) ──
    function GroupContent() {
        if (groupError) {
            return (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" /> {groupError}
                </div>
            );
        }
        if (groupLoading) {
            return (
                <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
                    <Loader2 size={16} className="animate-spin" /> Carregando...
                </div>
            );
        }
        if (!group) return null;
        if (activePlayers.length === 0 && inactivePlayers.length === 0) {
            return (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <Users2 size={32} className="opacity-30" />
                    <span className="text-sm">Nenhum jogador nesta patota.</span>
                </div>
            );
        }

        function PlayerCard({ p, dim = false }: { p: PlayerDto; dim?: boolean }) {
            const isMe = p.id === activePlayerId;
            const canEdit = isAdminOfGroup || isGod || isMe;
            const initials = p.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
            const pmt = (isFinanceiroOfGroup || isGod) ? paymentMap.get(p.id) : undefined;
            const pendingTotal = pmt ? pmt.pendingMonths + pmt.pendingExtras : 0;
            return (
                <div className={[
                    "rounded-xl border bg-white p-3 flex flex-col gap-2 shadow-sm transition-all",
                    dim ? "opacity-50" : "",
                    isMe ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
                ].join(" ")}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-9 w-9 rounded-full text-xs font-bold flex items-center justify-center shrink-0 select-none ${isMe ? 'bg-emerald-600 text-white' : p.isGuest ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                                <span className="text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                                <span className="shrink-0 leading-none">
                                    <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />
                                </span>
                            </div>
                            {p.userName && <div className="text-[11px] text-slate-400 truncate">@{p.userName}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {isMe && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none">Você</span>
                            )}
                            {canEdit && (
                                <button type="button" onClick={() => setEditPlayer(p)}
                                    className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="Editar jogador" aria-label="Editar jogador">
                                    <Pencil size={11} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* star rating — admin only */}
                    {p.isGuest && p.guestStarRating != null && (isAdminOfGroup || isGod) && (
                        <div className="text-[12px] leading-none text-amber-400">
                            {"★".repeat(p.guestStarRating)}
                            <span className="text-slate-200">{"★".repeat(5 - p.guestStarRating)}</span>
                        </div>
                    )}

                    {/* payment badge */}
                    {pmt && (
                        pendingTotal === 0 ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 w-fit">
                                <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                <span className="text-[10px] text-emerald-700 font-medium">Em dia</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 w-fit">
                                <AlertCircle size={11} className="text-rose-500 shrink-0" />
                                <span className="text-[10px] text-rose-700 font-medium">
                                    {pendingTotal} pendência{pendingTotal !== 1 ? 's' : ''}
                                </span>
                            </div>
                        )
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-5">
                {/* ── Mensalistas ── */}
                {activePlayers.length === 0 ? (
                    <div className="text-sm text-slate-400 italic">Nenhum mensalista ativo.</div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
                                <Check size={11} className="text-white" />
                            </div>
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mensalistas</span>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">{activePlayers.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                            {sortedPlayers.map((p) => <PlayerCard key={p.id} p={p} />)}
                        </div>
                    </div>
                )}

                {/* ── Convidados ── */}
                {guestPlayers.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-amber-400 flex items-center justify-center shrink-0">
                                <UserPlus size={11} className="text-white" />
                            </div>
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Convidados</span>
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">{guestPlayers.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                            {guestPlayers.map((p) => <PlayerCard key={p.id} p={p} />)}
                        </div>
                    </div>
                )}

                {/* ── Inativos (admin only) ── */}
                {inactivePlayers.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-slate-400 flex items-center justify-center shrink-0">
                                <X size={11} className="text-white" />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inativos</span>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{inactivePlayers.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                            {inactivePlayers.map((p) => <PlayerCard key={p.id} p={p} dim />)}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Botões de cabeçalho (sobre fundo escuro) ──
    const darkBtn = "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors";
    function HeaderButtons() {
        return (
            <div className="flex items-center gap-2 shrink-0">
                {(isAdminOfGroup || isGod) && (
                    <>
                        <button
                            type="button"
                            className={`${darkBtn} bg-white/10 border-white/20 text-white hover:bg-white/20`}
                            onClick={() => setAddGuestOpen(true)}
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">Convidado</span>
                        </button>
                        <button
                            type="button"
                            className={`${darkBtn} bg-white text-slate-900 border-transparent hover:bg-slate-100`}
                            onClick={() => setInviteOpen(true)}
                        >
                            <UserPlus size={15} />
                            <span className="hidden sm:inline">Convidar</span>
                        </button>
                    </>
                )}
                {!isAdminOfGroup && !isGod && activePlayerId && myPlayerInExpandedGroup && !myPlayerInExpandedGroup.isGuest && (
                    <button
                        type="button"
                        className={`${darkBtn} bg-rose-500/20 border-rose-400/30 text-rose-300 hover:bg-rose-500/30`}
                        onClick={() => setLeaveConfirmOpen(true)}
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Sair</span>
                    </button>
                )}
                {(isAdminOfGroup || isGod) && group?.createdByUserId === currentUserId && (
                    <button
                        type="button"
                        className={`${darkBtn} bg-rose-500/20 border-rose-400/30 text-rose-300 hover:bg-rose-500/30`}
                        onClick={() => setCreatorLeaveOpen(true)}
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Sair</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Loading inicial */}
            {mineLoading ? (
                <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white px-6 py-6 shadow-lg">
                    <div className="flex items-center gap-3 text-white/60">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Carregando patotas...</span>
                    </div>
                </div>
            ) : myGroups.length === 0 ? (
                /* 0 grupos */
                <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white px-6 py-10 shadow-lg flex flex-col items-center gap-3">
                    <Users2 size={36} className="opacity-30" />
                    <p className="text-white/50 text-sm">Você não faz parte de nenhuma patota.</p>
                </div>
            ) : myGroups.length === 1 ? (
                /* 1 grupo — layout expandido */
                <div className="space-y-4">
                    <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                        <div className="relative flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-black shrink-0 select-none">
                                    {(group?.name ?? myGroups[0].groupName).charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-xl font-black leading-tight truncate">{group?.name ?? myGroups[0].groupName}</h1>
                                    <p className="text-sm text-white/50 mt-0.5">
                                        {groupLoading ? 'Carregando...' : group
                                            ? `${activePlayers.length} mensalista${activePlayers.length !== 1 ? 's' : ''} · ${guestPlayers.length} convidado${guestPlayers.length !== 1 ? 's' : ''}`
                                            : ''}
                                    </p>
                                </div>
                            </div>
                            {groupLoading
                                ? <Loader2 size={16} className="animate-spin text-white/50 shrink-0" />
                                : group ? <HeaderButtons /> : null}
                        </div>
                    </div>
                    <div className="card p-5 shadow-sm">
                        <GroupContent />
                    </div>
                </div>
            ) : (
                /* 2+ grupos — accordion */
                <div className="space-y-4">
                    <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 overflow-hidden shadow-lg">
                        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="relative flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                                <Users2 size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black leading-tight">Minhas Patotas</h1>
                                <p className="text-sm text-white/50 mt-0.5">{myGroups.length} patotas</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {myGroups.map(({ groupId, groupName }) => {
                            const isExpanded = expandedGroupId === groupId;
                            const isAdminHere = isGroupAdmin(groupId) || isGod;
                            const myPlayerHere = myPlayers.find(p => p.groupId === groupId);
                            return (
                                <div key={groupId} className={["card p-0 overflow-hidden transition-shadow", isExpanded ? "shadow-md ring-1 ring-slate-900/10" : "shadow-sm"].join(" ")}>
                                    {/* Linha clicável */}
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(groupId)}
                                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={["h-9 w-9 rounded-xl text-sm font-black flex items-center justify-center shrink-0 select-none transition-colors", isExpanded ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"].join(" ")}>
                                                {groupName.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-900 text-sm truncate">{groupName}</div>
                                                {isAdminHere && (
                                                    <div className="text-[11px] text-slate-400">Você administra</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {isExpanded && (
                                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                    {isAdminHere && (
                                                        <>
                                                            <button type="button" className="btn btn-secondary flex items-center gap-1 text-xs px-2.5 py-1.5" onClick={() => setAddGuestOpen(true)}>
                                                                <Plus size={13} /><span className="hidden sm:inline">Convidado</span>
                                                            </button>
                                                            <button type="button" className="btn btn-primary flex items-center gap-1 text-xs px-2.5 py-1.5" onClick={() => setInviteOpen(true)}>
                                                                <UserPlus size={13} /><span className="hidden sm:inline">Convidar</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {!isAdminHere && myPlayerHere && !myPlayerHere.isGuest && (
                                                        <button type="button" className="btn flex items-center gap-1 text-xs px-2.5 py-1.5 text-rose-600 border border-rose-200 hover:bg-rose-50" onClick={() => setLeaveConfirmOpen(true)}>
                                                            <LogOut size={13} /><span className="hidden sm:inline">Sair</span>
                                                        </button>
                                                    )}
                                                    {isAdminHere && group?.createdByUserId === currentUserId && (
                                                        <button type="button" className="btn flex items-center gap-1 text-xs px-2.5 py-1.5 text-rose-600 border border-rose-200 hover:bg-rose-50" onClick={() => setCreatorLeaveOpen(true)}>
                                                            <LogOut size={13} /><span className="hidden sm:inline">Sair</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <ChevronDown
                                                size={16}
                                                className={["text-slate-400 transition-transform duration-200", isExpanded ? "rotate-180" : ""].join(" ")}
                                            />
                                        </div>
                                    </button>

                                    {/* Conteúdo expandido */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 p-5">
                                            <GroupContent />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modais — sempre presentes */}
            <EditPlayerModal
                open={!!editPlayer}
                player={editPlayer}
                isAdmin={isAdminOfGroup || isGod}
                onClose={() => setEditPlayer(null)}
                onSaved={loadGroup}
            />

            <LeaveConfirmModal
                open={leaveConfirmOpen}
                onClose={() => setLeaveConfirmOpen(false)}
                onConfirm={handleLeave}
            />

            <AddGuestModal
                open={addGuestOpen}
                onClose={() => setAddGuestOpen(false)}
                submitLabel="Adicionar à patota"
                onSubmit={async (name, isGoalkeeper, starRating) => {
                    await PlayersApi.create({
                        name,
                        groupId: expandedGroupId,
                        skillPoints: 0,
                        isGoalkeeper,
                        isGuest: true,
                        status: 1,
                        guestStarRating: starRating ?? undefined,
                    } as any);
                    loadGroup();
                }}
            />

            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                groupId={expandedGroupId ?? ""}
                groupName={group?.name ?? ""}
                existingUserIds={existingUserIds}
                guestPlayers={guestPlayers}
            />

            <CreatorLeaveModal
                open={creatorLeaveOpen}
                group={group}
                currentUserId={currentUserId}
                activePlayerId={activePlayerId}
                onClose={() => setCreatorLeaveOpen(false)}
                onDone={() => { setCreatorLeaveOpen(false); loadMine(); loadGroup(); }}
            />
        </div>
    );
}
