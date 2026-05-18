import React, { useEffect, useState } from "react";
import {
    Loader2, Search, Trash2, AlertTriangle, ChevronDown, ChevronRight,
    Users, CalendarDays, Palette, Edit2, Check, X,
    ToggleLeft, ToggleRight, UserX, UserCheck, Zap, Activity,
    Shield, BarChart3, ClipboardList, Calendar, Bell, CreditCard,
    Crown, Landmark, Plus, Send, UserCog,
} from "lucide-react";
import {
    GroupsApi, PlayersApi, MatchesApi, TeamColorApi,
    UsersApi, PollsApi, CalendarApi, PaymentsApi, GodModeApi,
} from "../../api/endpoints";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRow = {
    userId: string;
    firstName?: string | null;
    lastName?: string | null;
    userName?: string | null;
    email?: string | null;
    role: number;
    status: number;
};

type PlayerRow = {
    id: string;
    name: string;
    userId: string | null;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
};

type GroupRow = {
    id: string;
    name: string;
    adminIds: string[];
    financeiroIds: string[];
    createdByUserId: string;
    status: number;
    players: PlayerRow[];
};

type MatchRow = {
    matchId: string;
    status: number;
    statusName?: string;
    placeName?: string | null;
    playedAt?: string | null;
};

type PollRow = {
    id: string;
    title: string;
    status: number;
    statusName?: string;
    deadlineDate?: string | null;
};

type CalendarRow = {
    id: string;
    title: string;
    eventDate: string;
    eventTime?: string | null;
    categoryName?: string | null;
};

type ColorRow = {
    id: string;
    name: string;
    hexValue: string;
    isActive: boolean;
};

type ExtraChargeRow = {
    id: string;
    name: string;
    description: string | null;
    amount: number;
    dueDate: string | null;
    isCancelled: boolean;
    paidCount: number;
    pendingCount: number;
    totalCount: number;
};

type SubTab = "players" | "matches" | "polls" | "calendar" | "colors" | "payments" | "roles";
type MainTab = "overview" | "users" | "groups";

type LazyGroup = {
    matches?: MatchRow[];
    polls?: PollRow[];
    calendar?: CalendarRow[];
    colors?: ColorRow[];
    payments?: ExtraChargeRow[];
    loadingMatches?: boolean;
    loadingPolls?: boolean;
    loadingCalendar?: boolean;
    loadingColors?: boolean;
    loadingPayments?: boolean;
};

type ConfirmState = { title: string; body: string; action: () => Promise<void> };

type EditModal =
    | { kind: "user";   data: UserRow }
    | { kind: "player"; data: PlayerRow; groupId: string }
    | { kind: "group";  data: GroupRow };

type NotifyTarget =
    | { kind: "group";     id: string; name: string }
    | { kind: "user";      id: string; name: string }
    | { kind: "broadcast"; name: string };

type AddRoleForm = {
    groupId: string;
    kind: "admin" | "financeiro";
    userId: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function userName(u: UserRow) {
    const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    return full || u.userName || u.email || u.userId.slice(0, 8);
}

function roleBadge(role: number) {
    if (role === 3) return <span className="pill bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-semibold">GodMode</span>;
    if (role === 2) return <span className="pill bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 text-xs">Admin</span>;
    return <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs">Usuário</span>;
}

function statusBadge(status: number) {
    return status === 1
        ? <span className="pill bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">Ativo</span>
        : <span className="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-xs">Inativo</span>;
}

function matchStatusLabel(s: number) {
    const m: Record<number, string> = { 1: "Criada", 2: "Aceitação", 3: "Matchmaking", 4: "Em jogo", 5: "Encerrada", 6: "Pós-jogo", 7: "Finalizada" };
    return m[s] ?? `Status ${s}`;
}

function fmtDate(iso?: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtMoney(v: number) {
    return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function renderLoading() {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={18} /></div>;
}

function renderEmpty(msg: string) {
    return <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">{msg}</p>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GodModeAdminPage() {
    const [mainTab, setMainTab] = useState<MainTab>("overview");

    // Users — carregados imediatamente (eager)
    const [users, setUsers]               = useState<UserRow[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersLoaded, setUsersLoaded]   = useState(false);
    const [userSearch, setUserSearch]     = useState("");
    const [userFilter, setUserFilter]     = useState<"all" | "active" | "inactive">("all");

    // Groups
    const [groups, setGroups]               = useState<GroupRow[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(true);
    const [groupSearch, setGroupSearch]     = useState("");
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [subTabs, setSubTabs]             = useState<Record<string, SubTab>>({});
    const [lazy, setLazy]                   = useState<Record<string, LazyGroup>>({});

    // Shared
    const [confirm, setConfirm]               = useState<ConfirmState | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [editModal, setEditModal]           = useState<EditModal | null>(null);
    const [editLoading, setEditLoading]       = useState(false);
    const [globalError, setGlobalError]       = useState<string | null>(null);

    // Notify modal
    const [notifyTarget, setNotifyTarget]   = useState<NotifyTarget | null>(null);
    const [notifyForm, setNotifyForm]       = useState({ title: "", body: "" });
    const [notifyLoading, setNotifyLoading] = useState(false);
    const [notifySuccess, setNotifySuccess] = useState(false);
    const [notifySentCount, setNotifySentCount] = useState<number | null>(null);

    // Add role inline form
    const [addRoleForm, setAddRoleForm]       = useState<AddRoleForm | null>(null);
    const [addRoleLoading, setAddRoleLoading] = useState(false);

    // ── Load on mount ─────────────────────────────────────────────────────────

    useEffect(() => {
        // Users — eager (res.data.data é PagedResultDto<UserListItemDto>: { items, total, page, pageSize })
        UsersApi.list({ includeInactive: true, pageSize: 2000 })
            .then(res => {
                const paged = (res.data as any)?.data;
                const items: any[] = paged?.items ?? [];
                setUsers(items.map((u: any): UserRow => ({
                    userId:    u.id,
                    firstName: u.firstName,
                    lastName:  u.lastName,
                    userName:  u.userName,
                    email:     u.email,
                    role:      u.role,
                    status:    typeof u.status === "number" ? u.status : (u.status === "Active" ? 1 : 2),
                })));
                setUsersLoaded(true);
            })
            .catch(() => setGlobalError("Erro ao carregar usuários."))
            .finally(() => setUsersLoading(false));

        // Groups — eager
        GroupsApi.listAll()
            .then(res => setGroups((res.data.data ?? []) as GroupRow[]))
            .catch(() => setGlobalError("Erro ao carregar patotas."))
            .finally(() => setGroupsLoading(false));
    }, []);

    // ── Lazy load sub-tabs ────────────────────────────────────────────────────

    async function lazyLoad(groupId: string, tab: SubTab) {
        if (tab === "players" || tab === "roles") return; // computed locally

        const d = lazy[groupId];
        if (tab === "matches"  && (d?.matches   !== undefined || d?.loadingMatches))  return;
        if (tab === "polls"    && (d?.polls     !== undefined || d?.loadingPolls))    return;
        if (tab === "calendar" && (d?.calendar  !== undefined || d?.loadingCalendar)) return;
        if (tab === "colors"   && (d?.colors    !== undefined || d?.loadingColors))   return;
        if (tab === "payments" && (d?.payments  !== undefined || d?.loadingPayments)) return;

        setLazy(prev => ({
            ...prev,
            [groupId]: {
                ...prev[groupId],
                loadingMatches:  tab === "matches"  ? true : prev[groupId]?.loadingMatches,
                loadingPolls:    tab === "polls"    ? true : prev[groupId]?.loadingPolls,
                loadingCalendar: tab === "calendar" ? true : prev[groupId]?.loadingCalendar,
                loadingColors:   tab === "colors"   ? true : prev[groupId]?.loadingColors,
                loadingPayments: tab === "payments" ? true : prev[groupId]?.loadingPayments,
            },
        }));

        try {
            if (tab === "matches") {
                const res = await MatchesApi.list(groupId);
                setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], matches: (res.data.data ?? []) as MatchRow[], loadingMatches: false } }));
            }
            if (tab === "polls") {
                const res = await PollsApi.getPolls(groupId);
                setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], polls: ((res.data as any)?.data ?? []) as PollRow[], loadingPolls: false } }));
            }
            if (tab === "calendar") {
                const res = await CalendarApi.events(groupId, "2020-01-01", "2030-12-31");
                setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], calendar: (res.data.data ?? []) as CalendarRow[], loadingCalendar: false } }));
            }
            if (tab === "colors") {
                const res = await TeamColorApi.list(groupId);
                setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], colors: (res.data.data ?? []) as ColorRow[], loadingColors: false } }));
            }
            if (tab === "payments") {
                const res = await PaymentsApi.getExtraCharges(groupId);
                const raw = (res.data.data ?? []) as any[];
                const mapped: ExtraChargeRow[] = raw.map(c => ({
                    id: c.id,
                    name: c.name,
                    description: c.description ?? null,
                    amount: c.amount,
                    dueDate: c.dueDate ?? null,
                    isCancelled: c.isCancelled,
                    paidCount:    (c.payments ?? []).filter((p: any) => p.status === 1).length,
                    pendingCount: (c.payments ?? []).filter((p: any) => p.status === 0).length,
                    totalCount:   (c.payments ?? []).length,
                }));
                setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], payments: mapped, loadingPayments: false } }));
            }
        } catch {
            setLazy(prev => ({
                ...prev,
                [groupId]: {
                    ...prev[groupId],
                    loadingMatches:  tab === "matches"  ? false : prev[groupId]?.loadingMatches,
                    loadingPolls:    tab === "polls"    ? false : prev[groupId]?.loadingPolls,
                    loadingCalendar: tab === "calendar" ? false : prev[groupId]?.loadingCalendar,
                    loadingColors:   tab === "colors"   ? false : prev[groupId]?.loadingColors,
                    loadingPayments: tab === "payments" ? false : prev[groupId]?.loadingPayments,
                },
            }));
        }
    }

    function switchSubTab(groupId: string, tab: SubTab) {
        setSubTabs(prev => ({ ...prev, [groupId]: tab }));
        setAddRoleForm(null);
        lazyLoad(groupId, tab);
    }

    function toggleGroup(groupId: string) {
        if (expandedGroup === groupId) { setExpandedGroup(null); return; }
        setExpandedGroup(groupId);
        if (!subTabs[groupId]) setSubTabs(prev => ({ ...prev, [groupId]: "players" }));
    }

    // ── Confirm helper ────────────────────────────────────────────────────────

    function ask(title: string, body: string, action: () => Promise<void>) {
        setConfirm({ title, body, action });
    }

    async function runConfirm() {
        if (!confirm) return;
        setConfirmLoading(true);
        try { await confirm.action(); } finally { setConfirmLoading(false); setConfirm(null); }
    }

    // ── User actions ──────────────────────────────────────────────────────────

    function toggleUserStatus(u: UserRow) {
        const active = u.status === 1;
        ask(
            active ? `Inativar "${userName(u)}"?` : `Reativar "${userName(u)}"?`,
            active ? "O usuário não poderá mais acessar o sistema." : "O usuário poderá acessar o sistema novamente.",
            async () => {
                if (active) await UsersApi.inactivate(u.userId);
                else        await UsersApi.reactivate(u.userId);
                setUsers(prev => prev.map(x => x.userId === u.userId ? { ...x, status: active ? 2 : 1 } : x));
            }
        );
    }

    async function saveUserEdit(form: { firstName: string; lastName: string; email: string }) {
        if (!editModal || editModal.kind !== "user") return;
        setEditLoading(true);
        try {
            await UsersApi.update(editModal.data.userId, form as any);
            setUsers(prev => prev.map(u => u.userId === editModal.data.userId ? { ...u, ...form } : u));
            setEditModal(null);
        } finally { setEditLoading(false); }
    }

    // ── Group actions ─────────────────────────────────────────────────────────

    function deleteGroup(g: GroupRow) {
        ask(
            `Excluir patota "${g.name}"?`,
            "Todos os jogadores, partidas e dados serão removidos permanentemente.",
            async () => {
                await GroupsApi.remove(g.id);
                setGroups(prev => prev.filter(x => x.id !== g.id));
                if (expandedGroup === g.id) setExpandedGroup(null);
            }
        );
    }

    function toggleGroupStatus(g: GroupRow) {
        const active = g.status === 1;
        ask(
            active ? `Inativar patota "${g.name}"?` : `Reativar patota "${g.name}"?`,
            active ? "A patota ficará oculta para os membros." : "A patota voltará a ficar visível.",
            async () => {
                if (active) await GroupsApi.inactivate(g.id);
                else        await GroupsApi.reactivate(g.id);
                setGroups(prev => prev.map(x => x.id === g.id ? { ...x, status: active ? 2 : 1 } : x));
            }
        );
    }

    async function saveGroupEdit(form: { name: string }) {
        if (!editModal || editModal.kind !== "group") return;
        setEditLoading(true);
        try {
            await GroupsApi.update(editModal.data.id, { name: form.name });
            setGroups(prev => prev.map(g => g.id === editModal.data.id ? { ...g, name: form.name } : g));
            setEditModal(null);
        } finally { setEditLoading(false); }
    }

    // ── Player actions ────────────────────────────────────────────────────────

    function deletePlayer(groupId: string, p: PlayerRow) {
        ask(`Excluir jogador "${p.name}"?`, "O jogador será removido permanentemente da patota.", async () => {
            await PlayersApi.remove(p.id);
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, players: g.players.filter(x => x.id !== p.id) } : g));
        });
    }

    function togglePlayerStatus(groupId: string, p: PlayerRow) {
        const active = p.status === 1;
        ask(
            active ? `Inativar "${p.name}"?` : `Reativar "${p.name}"?`,
            active ? "O jogador ficará inativo na patota." : "O jogador voltará a ficar ativo.",
            async () => {
                if (active) await PlayersApi.inactivate(p.id);
                else        await PlayersApi.reactivate(p.id);
                setGroups(prev => prev.map(g =>
                    g.id === groupId
                        ? { ...g, players: g.players.map(x => x.id === p.id ? { ...x, status: active ? 2 : 1 } : x) }
                        : g
                ));
            }
        );
    }

    async function savePlayerEdit(form: { name: string; skillPoints: number; isGoalkeeper: boolean }) {
        if (!editModal || editModal.kind !== "player") return;
        setEditLoading(true);
        try {
            await PlayersApi.update(editModal.data.id, form);
            const { groupId } = editModal;
            setGroups(prev => prev.map(g =>
                g.id === groupId
                    ? { ...g, players: g.players.map(p => p.id === editModal.data.id ? { ...p, ...form } : p) }
                    : g
            ));
            setEditModal(null);
        } finally { setEditLoading(false); }
    }

    // ── Lazy-data actions ─────────────────────────────────────────────────────

    function deleteMatch(groupId: string, m: MatchRow) {
        ask(`Excluir partida "${m.placeName ?? fmtDate(m.playedAt)}"?`, "Todos os dados da partida serão removidos.", async () => {
            await MatchesApi.remove(groupId, m.matchId);
            setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], matches: (prev[groupId]?.matches ?? []).filter(x => x.matchId !== m.matchId) } }));
        });
    }

    function deletePoll(groupId: string, p: PollRow) {
        ask(`Excluir votação "${p.title}"?`, "A votação e todos os votos serão removidos.", async () => {
            await PollsApi.deletePoll(groupId, p.id);
            setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], polls: (prev[groupId]?.polls ?? []).filter(x => x.id !== p.id) } }));
        });
    }

    function deleteCalEvent(groupId: string, ev: CalendarRow) {
        ask(`Excluir evento "${ev.title}"?`, "O evento será removido permanentemente.", async () => {
            await CalendarApi.deleteEvent(groupId, ev.id);
            setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], calendar: (prev[groupId]?.calendar ?? []).filter(x => x.id !== ev.id) } }));
        });
    }

    function deleteColor(groupId: string, c: ColorRow) {
        ask(`Excluir cor "${c.name}"?`, "A cor será removida permanentemente.", async () => {
            await TeamColorApi.remove(groupId, c.id);
            setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], colors: (prev[groupId]?.colors ?? []).filter(x => x.id !== c.id) } }));
        });
    }

    async function toggleColorActive(groupId: string, c: ColorRow) {
        if (c.isActive) await TeamColorApi.deactivate(groupId, c.id);
        else            await TeamColorApi.activate(groupId, c.id);
        setLazy(prev => ({ ...prev, [groupId]: { ...prev[groupId], colors: (prev[groupId]?.colors ?? []).map(x => x.id === c.id ? { ...x, isActive: !c.isActive } : x) } }));
    }

    // ── Payments actions ──────────────────────────────────────────────────────

    function cancelCharge(groupId: string, c: ExtraChargeRow) {
        ask(
            `Cancelar cobrança "${c.name}"?`,
            "A cobrança será marcada como cancelada. Esta ação não pode ser desfeita.",
            async () => {
                await PaymentsApi.cancelExtraCharge(groupId, c.id);
                setLazy(prev => ({
                    ...prev,
                    [groupId]: {
                        ...prev[groupId],
                        payments: (prev[groupId]?.payments ?? []).map(x => x.id === c.id ? { ...x, isCancelled: true } : x),
                    },
                }));
            }
        );
    }

    // ── Roles actions ─────────────────────────────────────────────────────────

    function removeAdmin(g: GroupRow, userId: string) {
        const u = users.find(x => x.userId === userId);
        const name = u ? userName(u) : userId.slice(0, 8);
        ask(`Remover "${name}" como admin de "${g.name}"?`, "O usuário perderá as permissões de administrador nesta patota.", async () => {
            await GroupsApi.removeAdmin(g.id, userId);
            setGroups(prev => prev.map(x => x.id === g.id ? { ...x, adminIds: x.adminIds.filter(id => id !== userId) } : x));
        });
    }

    function removeFinanceiro(g: GroupRow, userId: string) {
        const u = users.find(x => x.userId === userId);
        const name = u ? userName(u) : userId.slice(0, 8);
        ask(`Remover "${name}" como financeiro de "${g.name}"?`, "O usuário perderá as permissões financeiras nesta patota.", async () => {
            await GroupsApi.removeFinanceiro(g.id, userId);
            setGroups(prev => prev.map(x => x.id === g.id ? { ...x, financeiroIds: x.financeiroIds.filter(id => id !== userId) } : x));
        });
    }

    async function submitAddRole() {
        if (!addRoleForm || !addRoleForm.userId) return;
        setAddRoleLoading(true);
        try {
            const { groupId, kind, userId } = addRoleForm;
            if (kind === "admin")       await GroupsApi.addAdmin(groupId, userId);
            else                        await GroupsApi.addFinanceiro(groupId, userId);
            setGroups(prev => prev.map(g => {
                if (g.id !== groupId) return g;
                return kind === "admin"
                    ? { ...g, adminIds:       [...g.adminIds,       userId] }
                    : { ...g, financeiroIds:  [...g.financeiroIds,  userId] };
            }));
            setAddRoleForm(null);
        } finally { setAddRoleLoading(false); }
    }

    // ── Notify actions ────────────────────────────────────────────────────────

    function openNotify(target: NotifyTarget) {
        setNotifyTarget(target);
        setNotifyForm({ title: "", body: "" });
        setNotifySuccess(false);
        setNotifySentCount(null);
    }

    async function sendNotify() {
        if (!notifyTarget || !notifyForm.title || !notifyForm.body) return;
        setNotifyLoading(true);
        try {
            if (notifyTarget.kind === "group") {
                await GodModeApi.notifyGroup(notifyTarget.id, { title: notifyForm.title, body: notifyForm.body });
            } else if (notifyTarget.kind === "broadcast") {
                const res = await GodModeApi.notifyAll({ title: notifyForm.title, body: notifyForm.body });
                setNotifySentCount((res.data as any)?.data?.sent ?? null);
            } else {
                await GodModeApi.notifyUser(notifyTarget.id, { title: notifyForm.title, body: notifyForm.body });
            }
            setNotifySuccess(true);
        } finally { setNotifyLoading(false); }
    }

    // ── Derived ───────────────────────────────────────────────────────────────

    const filteredUsers = users
        .filter(u => userFilter === "all" ? true : userFilter === "active" ? u.status === 1 : u.status !== 1)
        .filter(u => {
            const q = userSearch.toLowerCase();
            return !q || userName(u).toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
        });

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()));
    const totalPlayers   = groups.reduce((s, g) => s + g.players.length, 0);
    const activeGroups   = groups.filter(g => g.status === 1).length;
    const inactiveUsers  = users.filter(u => u.status !== 1).length;

    // Look up user display name from loaded users list (for roles tab)
    function lookupUserName(userId: string) {
        const u = users.find(x => x.userId === userId);
        return u ? userName(u) : `#${userId.slice(0, 8)}`;
    }

    // ── Sub-tab bar ───────────────────────────────────────────────────────────

    function SubTabBar({ groupId }: { groupId: string }) {
        const cur = subTabs[groupId] ?? "players";
        const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
            { key: "players",  label: "Jogadores",  icon: <Users        size={12} /> },
            { key: "roles",    label: "Funções",    icon: <UserCog      size={12} /> },
            { key: "matches",  label: "Partidas",   icon: <CalendarDays size={12} /> },
            { key: "polls",    label: "Votações",   icon: <ClipboardList size={12} /> },
            { key: "payments", label: "Cobranças",  icon: <CreditCard   size={12} /> },
            { key: "calendar", label: "Calendário", icon: <Calendar     size={12} /> },
            { key: "colors",   label: "Cores",      icon: <Palette      size={12} /> },
        ];
        return (
            <div className="flex border-b bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 overflow-x-auto">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => switchSubTab(groupId, t.key)}
                        className={[
                            "flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 whitespace-nowrap transition shrink-0",
                            cur === t.key
                                ? "border-slate-900 text-slate-900 font-semibold dark:border-white dark:text-white"
                                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400",
                        ].join(" ")}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-full bg-slate-50 dark:bg-slate-950">

            {/* Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <Zap size={20} className="text-amber-400" />
                    </div>
                    <div>
                        <div className="text-white font-bold text-lg leading-tight">Painel God Mode</div>
                        <div className="text-slate-400 text-xs mt-0.5">Controle total sobre todos os dados do sistema</div>
                    </div>
                    <span className="ml-auto pill bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shrink-0">
                        ⚡ ACESSO IRRESTRITO
                    </span>
                </div>
            </div>

            {/* Main tab bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6">
                <div className="max-w-6xl mx-auto flex">
                    {([
                        { key: "overview", label: "Visão Geral", icon: <BarChart3 size={14} /> },
                        { key: "users",    label: "Usuários",    icon: <Users    size={14} />, count: usersLoaded ? users.length : undefined },
                        { key: "groups",   label: "Patotas",     icon: <Shield   size={14} />, count: groups.length || undefined },
                    ] as { key: MainTab; label: string; icon: React.ReactNode; count?: number }[]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setMainTab(t.key)}
                            className={[
                                "flex items-center gap-2 px-4 py-3.5 text-sm border-b-2 transition font-medium",
                                mainTab === t.key
                                    ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400",
                            ].join(" ")}
                        >
                            {t.icon}
                            {t.label}
                            {t.count !== undefined && (
                                <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs">{t.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">

                {globalError && (
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
                        <AlertTriangle size={15} /> {globalError}
                    </div>
                )}

                {/* ══ VISÃO GERAL ══ */}
                {mainTab === "overview" && (
                    <div className="space-y-4">
                        {(groupsLoading || usersLoading)
                            ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
                            : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: "Total patotas",    value: groups.length,  icon: <Shield    size={22} />, cls: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800" },
                                        { label: "Patotas ativas",   value: activeGroups,   icon: <Activity  size={22} />, cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" },
                                        { label: "Total jogadores",  value: totalPlayers,   icon: <Users     size={22} />, cls: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20" },
                                        { label: "Usuários",         value: users.length,   icon: <BarChart3 size={22} />, cls: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" },
                                    ].map(c => (
                                        <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
                                            <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${c.cls}`}>{c.icon}</span>
                                            <div>
                                                <div className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{c.value}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }

                        {/* Stats secundários */}
                        {!groupsLoading && !usersLoading && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Contas inativas</div>
                                    <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{inactiveUsers}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Patotas inativas</div>
                                    <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{groups.length - activeGroups}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Média jogadores/patota</div>
                                    <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                        {groups.length > 0 ? (totalPlayers / groups.length).toFixed(1) : "—"}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Broadcast */}
                        {!groupsLoading && !usersLoading && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4 shadow-sm">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <Bell size={15} className="text-sky-500" /> Notificação global
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Envia push para todos os {users.filter(u => u.status === 1).length} usuários ativos
                                    </p>
                                </div>
                                <button
                                    onClick={() => openNotify({ kind: "broadcast", name: "Todos os usuários ativos" })}
                                    className="btn btn-primary flex items-center gap-1.5 text-xs py-2 px-3 shrink-0"
                                >
                                    <Send size={12} /> Notificar todos
                                </button>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 text-sm space-y-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">O que você pode fazer aqui</p>
                            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                                <li><strong className="text-slate-700 dark:text-slate-300">Usuários</strong> — editar, ativar/inativar, enviar notificação</li>
                                <li><strong className="text-slate-700 dark:text-slate-300">Patotas</strong> — editar nome, ativar/inativar, excluir, notificar todos</li>
                                <li><strong className="text-slate-700 dark:text-slate-300">Funções</strong> — ver e gerenciar admins e financeiros de cada patota</li>
                                <li><strong className="text-slate-700 dark:text-slate-300">Cobranças extras</strong> — visualizar e cancelar cobranças por patota</li>
                                <li><strong className="text-slate-700 dark:text-slate-300">Jogadores, Partidas, Votações, Calendário, Cores</strong> — visualizar, editar e excluir</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* ══ USUÁRIOS ══ */}
                {mainTab === "users" && (
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input className="input pl-9 w-full" placeholder="Buscar por nome ou e-mail..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                            </div>
                            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                                {(["all", "active", "inactive"] as const).map(f => (
                                    <button key={f} onClick={() => setUserFilter(f)}
                                        className={["px-3 py-2 text-xs font-medium transition",
                                            userFilter === f
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700",
                                        ].join(" ")}
                                    >
                                        {{ all: "Todos", active: "Ativos", inactive: "Inativos" }[f]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            {usersLoading
                                ? renderLoading()
                                : filteredUsers.length === 0
                                    ? renderEmpty("Nenhum usuário encontrado.")
                                    : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400">
                                                        <th className="text-left px-4 py-3 font-medium">Nome</th>
                                                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">E-mail</th>
                                                        <th className="text-left px-4 py-3 font-medium">Perfil</th>
                                                        <th className="text-left px-4 py-3 font-medium">Status</th>
                                                        <th className="px-4 py-3 w-28" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {filteredUsers.map(u => (
                                                        <tr key={u.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{userName(u)}</td>
                                                            <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">{u.email ?? "—"}</td>
                                                            <td className="px-4 py-2.5">{roleBadge(u.role)}</td>
                                                            <td className="px-4 py-2.5">{statusBadge(u.status)}</td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-1 justify-end">
                                                                    <button title="Editar" onClick={() => setEditModal({ kind: "user", data: u })}
                                                                        className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition">
                                                                        <Edit2 size={13} />
                                                                    </button>
                                                                    <button title="Enviar notificação" onClick={() => openNotify({ kind: "user", id: u.userId, name: userName(u) })}
                                                                        className="h-7 w-7 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 flex items-center justify-center text-sky-500 transition">
                                                                        <Bell size={13} />
                                                                    </button>
                                                                    <button title={u.status === 1 ? "Inativar" : "Reativar"} onClick={() => toggleUserStatus(u)}
                                                                        className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${u.status === 1 ? "hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"}`}>
                                                                        {u.status === 1 ? <UserX size={13} /> : <UserCheck size={13} />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                            }
                        </div>
                    </div>
                )}

                {/* ══ PATOTAS ══ */}
                {mainTab === "groups" && (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="input pl-9 w-full" placeholder="Buscar patota..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
                        </div>

                        {groupsLoading
                            ? renderLoading()
                            : filteredGroups.length === 0
                                ? renderEmpty("Nenhuma patota encontrada.")
                                : (
                                    <div className="space-y-2">
                                        {filteredGroups.map(group => {
                                            const isOpen = expandedGroup === group.id;
                                            const subTab = subTabs[group.id] ?? "players";
                                            const ld     = lazy[group.id];

                                            return (
                                                <div key={group.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">

                                                    {/* Group header */}
                                                    <div
                                                        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition select-none"
                                                        onClick={() => toggleGroup(group.id)}
                                                    >
                                                        <span className="text-slate-400 shrink-0">
                                                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                        </span>
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">{group.name}</span>
                                                        {statusBadge(group.status)}
                                                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 hidden sm:flex items-center gap-2">
                                                            <span>{group.players.length} jogadores</span>
                                                            {group.adminIds.length > 0 && (
                                                                <span className="flex items-center gap-0.5"><Crown size={10} />{group.adminIds.length}</span>
                                                            )}
                                                            {(group.financeiroIds ?? []).length > 0 && (
                                                                <span className="flex items-center gap-0.5"><Landmark size={10} />{(group.financeiroIds ?? []).length}</span>
                                                            )}
                                                        </span>
                                                        <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
                                                            <button title="Notificar patota" onClick={() => openNotify({ kind: "group", id: group.id, name: group.name })}
                                                                className="h-7 w-7 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 flex items-center justify-center text-sky-500 transition">
                                                                <Bell size={13} />
                                                            </button>
                                                            <button title="Editar nome" onClick={() => setEditModal({ kind: "group", data: group })}
                                                                className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition">
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button title={group.status === 1 ? "Inativar" : "Reativar"} onClick={() => toggleGroupStatus(group)}
                                                                className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${group.status === 1 ? "hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"}`}>
                                                                {group.status === 1 ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                                            </button>
                                                            <button title="Excluir patota" onClick={() => deleteGroup(group)}
                                                                className="h-7 w-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-500 transition">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isOpen && (
                                                        <div className="border-t dark:border-slate-700">
                                                            <SubTabBar groupId={group.id} />
                                                            <div className="p-3">

                                                                {/* ── Jogadores ── */}
                                                                {subTab === "players" && (
                                                                    group.players.length === 0
                                                                        ? renderEmpty("Sem jogadores.")
                                                                        : <div className="space-y-0.5">
                                                                            {group.players.map(p => (
                                                                                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                                    <span className={`flex-1 text-sm min-w-0 truncate ${p.status !== 1 ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"}`}>{p.name}</span>
                                                                                    {p.isGuest && <span className="pill bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs shrink-0">Guest</span>}
                                                                                    {p.isGoalkeeper && <span className="pill bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 text-xs shrink-0">GK</span>}
                                                                                    {statusBadge(p.status)}
                                                                                    <span className="text-xs text-slate-400 w-12 text-right shrink-0">{p.skillPoints} pts</span>
                                                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                                                        <button title="Editar" onClick={() => setEditModal({ kind: "player", data: p, groupId: group.id })}
                                                                                            className="h-6 w-6 rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition">
                                                                                            <Edit2 size={11} />
                                                                                        </button>
                                                                                        {p.userId && (
                                                                                            <button title="Notificar usuário" onClick={() => openNotify({ kind: "user", id: p.userId!, name: p.name })}
                                                                                                className="h-6 w-6 rounded hover:bg-sky-50 dark:hover:bg-sky-900/20 flex items-center justify-center text-sky-400 transition">
                                                                                                <Bell size={11} />
                                                                                            </button>
                                                                                        )}
                                                                                        <button title={p.status === 1 ? "Inativar" : "Reativar"} onClick={() => togglePlayerStatus(group.id, p)}
                                                                                            className={`h-6 w-6 rounded flex items-center justify-center transition ${p.status === 1 ? "hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"}`}>
                                                                                            {p.status === 1 ? <UserX size={11} /> : <UserCheck size={11} />}
                                                                                        </button>
                                                                                        <button title="Excluir" onClick={() => deletePlayer(group.id, p)}
                                                                                            className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition">
                                                                                            <Trash2 size={11} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                )}

                                                                {/* ── Funções (Roles) ── */}
                                                                {subTab === "roles" && (
                                                                    <div className="space-y-4">

                                                                        {/* Admins */}
                                                                        <div>
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                                                    <Crown size={12} className="text-amber-500" /> Administradores
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => setAddRoleForm(
                                                                                        addRoleForm?.groupId === group.id && addRoleForm?.kind === "admin"
                                                                                            ? null
                                                                                            : { groupId: group.id, kind: "admin", userId: "" }
                                                                                    )}
                                                                                    className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 transition"
                                                                                >
                                                                                    <Plus size={11} /> Adicionar
                                                                                </button>
                                                                            </div>
                                                                            {group.adminIds.length === 0
                                                                                ? <p className="text-xs text-slate-400 py-2">Nenhum admin cadastrado.</p>
                                                                                : <div className="space-y-0.5">
                                                                                    {group.adminIds.map(uid => (
                                                                                        <div key={uid} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                                            <Crown size={11} className="text-amber-500 shrink-0" />
                                                                                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{lookupUserName(uid)}</span>
                                                                                            <span className="text-xs text-slate-400 font-mono hidden sm:block">{uid.slice(0, 8)}…</span>
                                                                                            <button title="Remover admin" onClick={() => removeAdmin(group, uid)}
                                                                                                className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition shrink-0">
                                                                                                <X size={11} />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            }
                                                                            {/* Add admin inline form */}
                                                                            {addRoleForm?.groupId === group.id && addRoleForm?.kind === "admin" && (
                                                                                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                                                                    <select
                                                                                        className="input flex-1 py-1.5 text-xs"
                                                                                        value={addRoleForm.userId}
                                                                                        onChange={e => setAddRoleForm(f => f ? { ...f, userId: e.target.value } : f)}
                                                                                    >
                                                                                        <option value="">Selecionar usuário…</option>
                                                                                        {group.players
                                                                                            .filter(p => p.userId && !group.adminIds.includes(p.userId))
                                                                                            .map(p => (
                                                                                                <option key={p.userId} value={p.userId!}>{p.name}</option>
                                                                                            ))
                                                                                        }
                                                                                    </select>
                                                                                    <button
                                                                                        onClick={submitAddRole}
                                                                                        disabled={!addRoleForm.userId || addRoleLoading}
                                                                                        className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                                                                                    >
                                                                                        {addRoleLoading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} OK
                                                                                    </button>
                                                                                    <button onClick={() => setAddRoleForm(null)} className="h-6 w-6 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400">
                                                                                        <X size={11} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Financeiros */}
                                                                        <div>
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                                                    <Landmark size={12} className="text-emerald-500" /> Financeiros
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => setAddRoleForm(
                                                                                        addRoleForm?.groupId === group.id && addRoleForm?.kind === "financeiro"
                                                                                            ? null
                                                                                            : { groupId: group.id, kind: "financeiro", userId: "" }
                                                                                    )}
                                                                                    className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 transition"
                                                                                >
                                                                                    <Plus size={11} /> Adicionar
                                                                                </button>
                                                                            </div>
                                                                            {(group.financeiroIds ?? []).length === 0
                                                                                ? <p className="text-xs text-slate-400 py-2">Nenhum financeiro cadastrado.</p>
                                                                                : <div className="space-y-0.5">
                                                                                    {(group.financeiroIds ?? []).map(uid => (
                                                                                        <div key={uid} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                                            <Landmark size={11} className="text-emerald-500 shrink-0" />
                                                                                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{lookupUserName(uid)}</span>
                                                                                            <span className="text-xs text-slate-400 font-mono hidden sm:block">{uid.slice(0, 8)}…</span>
                                                                                            <button title="Remover financeiro" onClick={() => removeFinanceiro(group, uid)}
                                                                                                className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition shrink-0">
                                                                                                <X size={11} />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            }
                                                                            {/* Add financeiro inline form */}
                                                                            {addRoleForm?.groupId === group.id && addRoleForm?.kind === "financeiro" && (
                                                                                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                                                                    <select
                                                                                        className="input flex-1 py-1.5 text-xs"
                                                                                        value={addRoleForm.userId}
                                                                                        onChange={e => setAddRoleForm(f => f ? { ...f, userId: e.target.value } : f)}
                                                                                    >
                                                                                        <option value="">Selecionar usuário…</option>
                                                                                        {group.players
                                                                                            .filter(p => p.userId && !(group.financeiroIds ?? []).includes(p.userId))
                                                                                            .map(p => (
                                                                                                <option key={p.userId} value={p.userId!}>{p.name}</option>
                                                                                            ))
                                                                                        }
                                                                                    </select>
                                                                                    <button
                                                                                        onClick={submitAddRole}
                                                                                        disabled={!addRoleForm.userId || addRoleLoading}
                                                                                        className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                                                                                    >
                                                                                        {addRoleLoading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} OK
                                                                                    </button>
                                                                                    <button onClick={() => setAddRoleForm(null)} className="h-6 w-6 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400">
                                                                                        <X size={11} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* ── Partidas ── */}
                                                                {subTab === "matches" && (
                                                                    (ld?.loadingMatches || ld?.matches === undefined)
                                                                        ? renderLoading()
                                                                        : ld.matches!.length === 0
                                                                            ? renderEmpty("Sem partidas.")
                                                                            : <div className="space-y-0.5">
                                                                                {ld.matches!.map(m => (
                                                                                    <div key={m.matchId} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate min-w-0">
                                                                                            {m.placeName ?? "Sem local"}{m.playedAt ? ` · ${fmtDate(m.playedAt)}` : ""}
                                                                                        </span>
                                                                                        <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs shrink-0">
                                                                                            {m.statusName ?? matchStatusLabel(m.status)}
                                                                                        </span>
                                                                                        <button title="Excluir" onClick={() => deleteMatch(group.id, m)}
                                                                                            className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition shrink-0">
                                                                                            <Trash2 size={11} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                )}

                                                                {/* ── Votações ── */}
                                                                {subTab === "polls" && (
                                                                    (ld?.loadingPolls || ld?.polls === undefined)
                                                                        ? renderLoading()
                                                                        : ld.polls!.length === 0
                                                                            ? renderEmpty("Sem votações.")
                                                                            : <div className="space-y-0.5">
                                                                                {ld.polls!.map(p => (
                                                                                    <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate min-w-0">{p.title}</span>
                                                                                        {p.deadlineDate && <span className="text-xs text-slate-400 shrink-0">{fmtDate(p.deadlineDate)}</span>}
                                                                                        <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs shrink-0">
                                                                                            {p.statusName ?? `Status ${p.status}`}
                                                                                        </span>
                                                                                        <button title="Excluir" onClick={() => deletePoll(group.id, p)}
                                                                                            className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition shrink-0">
                                                                                            <Trash2 size={11} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                )}

                                                                {/* ── Cobranças ── */}
                                                                {subTab === "payments" && (
                                                                    (ld?.loadingPayments || ld?.payments === undefined)
                                                                        ? renderLoading()
                                                                        : ld.payments!.length === 0
                                                                            ? renderEmpty("Sem cobranças extras.")
                                                                            : <div className="space-y-0.5">
                                                                                {ld.payments!.map(c => (
                                                                                    <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                                        <span className={`flex-1 text-sm min-w-0 truncate ${c.isCancelled ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>
                                                                                            {c.name}
                                                                                        </span>
                                                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                                                                                            {fmtMoney(c.amount)}
                                                                                        </span>
                                                                                        {c.totalCount > 0 && (
                                                                                            <span className="text-xs text-slate-400 shrink-0">
                                                                                                {c.paidCount}/{c.totalCount} pago(s)
                                                                                            </span>
                                                                                        )}
                                                                                        {c.dueDate && (
                                                                                            <span className="text-xs text-slate-400 shrink-0">{fmtDate(c.dueDate)}</span>
                                                                                        )}
                                                                                        {c.isCancelled
                                                                                            ? <span className="pill bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 text-xs shrink-0">Cancelada</span>
                                                                                            : (
                                                                                                <button title="Cancelar cobrança" onClick={() => cancelCharge(group.id, c)}
                                                                                                    className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition shrink-0">
                                                                                                    <Trash2 size={11} />
                                                                                                </button>
                                                                                            )
                                                                                        }
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                )}

                                                                {/* ── Calendário ── */}
                                                                {subTab === "calendar" && (
                                                                    (ld?.loadingCalendar || ld?.calendar === undefined)
                                                                        ? renderLoading()
                                                                        : ld.calendar!.length === 0
                                                                            ? renderEmpty("Sem eventos.")
                                                                            : <div className="space-y-0.5">
                                                                                {ld.calendar!.map(ev => (
                                                                                    <div key={ev.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate min-w-0">{ev.title}</span>
                                                                                        {ev.categoryName && <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs shrink-0">{ev.categoryName}</span>}
                                                                                        <span className="text-xs text-slate-400 shrink-0">{fmtDate(ev.eventDate)}</span>
                                                                                        <button title="Excluir" onClick={() => deleteCalEvent(group.id, ev)}
                                                                                            className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition shrink-0">
                                                                                            <Trash2 size={11} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                )}

                                                                {/* ── Cores ── */}
                                                                {subTab === "colors" && (
                                                                    (ld?.loadingColors || ld?.colors === undefined)
                                                                        ? renderLoading()
                                                                        : ld.colors!.length === 0
                                                                            ? renderEmpty("Sem cores.")
                                                                            : <div className="space-y-0.5">
                                                                                {ld.colors!.map(c => (
                                                                                    <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                                                        <span className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0" style={{ background: c.hexValue }} />
                                                                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate min-w-0">{c.name}</span>
                                                                                        <span className="text-xs font-mono text-slate-400 shrink-0">{c.hexValue}</span>
                                                                                        {!c.isActive && <span className="pill bg-slate-100 text-slate-400 dark:bg-slate-800 text-xs shrink-0">Inativa</span>}
                                                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                                                            <button title={c.isActive ? "Desativar" : "Ativar"} onClick={() => toggleColorActive(group.id, c)}
                                                                                                className={`h-6 w-6 rounded flex items-center justify-center transition ${c.isActive ? "hover:bg-amber-50 text-amber-500" : "hover:bg-emerald-50 text-emerald-500"}`}>
                                                                                                {c.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                                                                                            </button>
                                                                                            <button title="Excluir" onClick={() => deleteColor(group.id, c)}
                                                                                                className="h-6 w-6 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-rose-400 transition">
                                                                                                <Trash2 size={11} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                )}

                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                        }
                    </div>
                )}
            </div>

            {/* ══ CONFIRM MODAL ══ */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                                <AlertTriangle size={17} className="text-rose-600 dark:text-rose-400" />
                            </div>
                            <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{confirm.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{confirm.body}</div>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button className="btn text-sm py-1.5" onClick={() => setConfirm(null)} disabled={confirmLoading}>Cancelar</button>
                            <button className="btn btn-danger text-sm py-1.5 flex items-center gap-1.5" onClick={runConfirm} disabled={confirmLoading}>
                                {confirmLoading && <Loader2 size={13} className="animate-spin" />}
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ NOTIFY MODAL ══ */}
            {notifyTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                                <Bell size={14} className="text-sky-500" />
                                {notifyTarget.kind === "group"     ? "Notificar patota"
                                : notifyTarget.kind === "broadcast" ? "Notificação global"
                                :                                     "Notificar usuário"}
                            </span>
                            <button onClick={() => setNotifyTarget(null)} className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className={`text-xs rounded-lg px-3 py-2 ${notifyTarget.kind === "broadcast" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"}`}>
                                {notifyTarget.kind === "broadcast"
                                    ? <span>⚡ <strong>Broadcast</strong> — será enviado para todos os usuários ativos</span>
                                    : <>Destinatário: <strong className="text-slate-700 dark:text-slate-300">{notifyTarget.name}</strong></>
                                }
                            </div>
                            {notifySuccess
                                ? (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <Check size={20} className="text-emerald-600" />
                                        </div>
                                        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                                            {notifySentCount !== null
                                                ? `Enviado para ${notifySentCount} usuário(s)!`
                                                : "Notificação enviada!"}
                                        </p>
                                    </div>
                                )
                                : (
                                    <>
                                        <label className="block">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Título</span>
                                            <input className="input w-full" placeholder="Título da notificação" value={notifyForm.title}
                                                onChange={e => setNotifyForm(f => ({ ...f, title: e.target.value }))} />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Mensagem</span>
                                            <textarea className="input w-full resize-none" rows={3} placeholder="Texto da notificação"
                                                value={notifyForm.body} onChange={e => setNotifyForm(f => ({ ...f, body: e.target.value }))} />
                                        </label>
                                    </>
                                )
                            }
                        </div>
                        <div className="flex gap-2 justify-end px-5 pb-5">
                            <button className="btn text-sm py-1.5" onClick={() => setNotifyTarget(null)}>
                                {notifySuccess ? "Fechar" : "Cancelar"}
                            </button>
                            {!notifySuccess && (
                                <button
                                    className="btn btn-primary text-sm py-1.5 flex items-center gap-1.5"
                                    onClick={sendNotify}
                                    disabled={notifyLoading || !notifyForm.title || !notifyForm.body}
                                >
                                    {notifyLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                    Enviar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ EDIT MODALS ══ */}
            {editModal?.kind === "user"   && <UserEditModal   user={editModal.data}   loading={editLoading} onSave={saveUserEdit}   onClose={() => setEditModal(null)} />}
            {editModal?.kind === "player" && <PlayerEditModal player={editModal.data} loading={editLoading} onSave={savePlayerEdit} onClose={() => setEditModal(null)} groupId={editModal.groupId} />}
            {editModal?.kind === "group"  && <GroupEditModal  group={editModal.data}  loading={editLoading} onSave={saveGroupEdit}  onClose={() => setEditModal(null)} />}
        </div>
    );
}

// ── Shared Modal Shell ────────────────────────────────────────────────────────

function Modal({ title, children, loading, onSave, onClose }: {
    title: string; children: React.ReactNode; loading: boolean;
    onSave: () => void; onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{title}</span>
                    <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition">
                        <X size={15} />
                    </button>
                </div>
                <div className="p-5 space-y-3">{children}</div>
                <div className="flex gap-2 justify-end px-5 pb-5">
                    <button className="btn text-sm py-1.5" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button className="btn btn-primary text-sm py-1.5 flex items-center gap-1.5" onClick={onSave} disabled={loading}>
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

function LabeledInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
    return (
        <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{label}</span>
            <input className="input w-full" {...props} />
        </label>
    );
}

// ── Edit Modals ───────────────────────────────────────────────────────────────

function UserEditModal({ user, loading, onSave, onClose }: {
    user: UserRow; loading: boolean;
    onSave: (f: { firstName: string; lastName: string; email: string }) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", email: user.email ?? "" });
    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
    return (
        <Modal title="Editar usuário" loading={loading} onSave={() => onSave(form)} onClose={onClose}>
            <LabeledInput label="Nome"      value={form.firstName} onChange={set("firstName")} placeholder="Nome" />
            <LabeledInput label="Sobrenome" value={form.lastName}  onChange={set("lastName")}  placeholder="Sobrenome" />
            <LabeledInput label="E-mail"    value={form.email}     onChange={set("email")}     placeholder="email@exemplo.com" type="email" />
        </Modal>
    );
}

function PlayerEditModal({ player, loading, onSave, onClose }: {
    player: PlayerRow; groupId: string; loading: boolean;
    onSave: (f: { name: string; skillPoints: number; isGoalkeeper: boolean }) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({ name: player.name, skillPoints: player.skillPoints, isGoalkeeper: player.isGoalkeeper });
    return (
        <Modal title="Editar jogador" loading={loading} onSave={() => onSave(form)} onClose={onClose}>
            <LabeledInput label="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <LabeledInput label="Habilidade (pts)" value={form.skillPoints} onChange={e => setForm(f => ({ ...f, skillPoints: Number(e.target.value) }))} type="number" min={0} max={100} />
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input type="checkbox" checked={form.isGoalkeeper} onChange={e => setForm(f => ({ ...f, isGoalkeeper: e.target.checked }))} className="w-4 h-4 rounded accent-sky-600" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Goleiro</span>
            </label>
        </Modal>
    );
}

function GroupEditModal({ group, loading, onSave, onClose }: {
    group: GroupRow; loading: boolean;
    onSave: (f: { name: string }) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(group.name);
    return (
        <Modal title="Editar patota" loading={loading} onSave={() => onSave({ name })} onClose={onClose}>
            <LabeledInput label="Nome da patota" value={name} onChange={e => setName(e.target.value)} />
        </Modal>
    );
}
