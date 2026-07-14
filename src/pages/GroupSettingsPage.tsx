import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ShieldOff, ShieldPlus, Shield, AlertTriangle, Wallet, Users, Settings, CalendarClock, DollarSign, AlertCircle, Save, Trophy, BarChart2, Pencil } from 'lucide-react';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { GroupSettingsApi, GroupsApi, MatchesApi, UsersApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { getResponseMessage } from '../api/apiResponse';
import { isGodMode } from '../auth/guards';
import { IconPicker } from '../components/IconPicker';
import { IconRenderer } from '../components/IconRenderer';
import { invalidateGroupIcons } from '../hooks/useGroupIcons';
import {
    GOAL_OPTIONS, GOALKEEPER_OPTIONS, ASSIST_OPTIONS,
    OWN_GOAL_OPTIONS, MVP_OPTIONS, PLAYER_OPTIONS, RANK_OPTIONS, DEFAULT_ICONS,
} from '../lib/groupIcons';
import { AddAdminModal } from '../components/modals/AddAdminModal';
import { AddFinanceiroModal } from '../components/modals/AddFinanceiroModal';

const DAY_OPTIONS = [
    { value: '', label: 'Sem padrão' },
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' },
];

// ─── Tipos locais ────────────────────────────────────────────────────────────

type AdminUser = {
    userId: string;
    userName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
};

type ManualMatchSchedule = {
    playedAt: string;
    created?: boolean;
    matchId?: string | null;
};

type GroupDetailDto = {
    id: string;
    name: string;
    createdByUserId?: string | null;
    adminIds: string[];
    adminUsers?: AdminUser[];
    financeiroIds: string[];
    financeiroUsers?: AdminUser[];
};

type UserResult = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
};

function fullName(u: UserResult | AdminUser) {
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.userName || 'Admin';
}

function initials(u: UserResult | AdminUser) {
    const f = u.firstName?.[0] ?? '';
    const l = u.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || (u.userName?.[0] ?? '?').toUpperCase();
}

// ─── Tipos de confirmação ─────────────────────────────────────────────────────

type ConfirmState = {
    label: string;
    onConfirm: () => Promise<void>;
};

// ─── GroupSettingsPage ────────────────────────────────────────────────────────

export default function GroupSettingsPage() {
    const nav = useNavigate();
    const active = useAccountStore((s) => s.getActive());
    const groupId = active?.activeGroupId;
    const currentUserId = active?.userId;
    const _roles = active?.roles ?? [];
    const isGod = isGodMode();
    const isGlobalAdmin = _roles.includes('Admin') || _roles.includes('GodMode');
    const isGroupAdm = isGlobalAdmin ||
        (!!groupId && (active?.groupAdminIds?.includes(groupId) ?? false));

    useEffect(() => {
        if (!isGroupAdm) {
            nav('/app', { replace: true });
        }
    }, [isGroupAdm, nav]);

    // ── player limits ──────────────────────────────────────────────
    const [minPlayers, setMinPlayers] = useState(5);
    const [maxPlayers, setMaxPlayers] = useState(6);

    // ── match defaults ─────────────────────────────────────────────
    const [defaultPlaceName, setDefaultPlaceName]     = useState('');
    const [defaultDayOfWeek, setDefaultDayOfWeek]     = useState<string>('');
    const [defaultKickoffTime, setDefaultKickoffTime] = useState('');

    const [matchSchedulingEnabled, setMatchSchedulingEnabled] = useState(false);
    const [matchSchedulingMode, setMatchSchedulingMode] = useState(0);
    const [matchScheduleDayOfWeek, setMatchScheduleDayOfWeek] = useState<string>('');
    const [matchScheduleTime, setMatchScheduleTime] = useState('');
    const [manualMatchSchedules, setManualMatchSchedules] = useState<ManualMatchSchedule[]>([]);
    const [manualScheduleDate, setManualScheduleDate] = useState('');
    const [manualScheduleTime, setManualScheduleTime] = useState('');
    const [matchEdit, setMatchEdit] = useState<{
        scheduleIndex?: number | null;
        matchId: string;
        placeName: string;
        date: string;
        time: string;
    } | null>(null);
    const [savingMatchEdit, setSavingMatchEdit] = useState(false);

    // ── pagamento ──────────────────────────────────────────────────
    /** 0 = Monthly, 1 = PerGame */
    const [paymentMode,           setPaymentMode]           = useState<number>(0);
    const [monthlyFee,            setMonthlyFee]            = useState<string>('');
    const [goalkeeperMonthlyFee,  setGoalkeeperMonthlyFee]  = useState<string>('');

    // ── regra de empate MVP ────────────────────────────────────────
    /** 0 = NoMvp, 1 = AllMvp, 2 = AllMvpUpToMax */
    const [mvpTieRule,           setMvpTieRule]           = useState<number>(1);
    const [mvpTieMaxPlayers,     setMvpTieMaxPlayers]     = useState<number>(2);
    const [showPlayerStats,      setShowPlayerStats]      = useState<boolean>(false);
    const [autoFinalizeMvpHours, setAutoFinalizeMvpHours] = useState<number | null>(null);

    // ── tab ────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState(0);

    // ── pagamento — notificações ───────────────────────────────────
    const [paymentDueDay, setPaymentDueDay] = useState<number | null>(null);

    // ── ícones ─────────────────────────────────────────────────────
    const [goalIcon,       setGoalIcon]       = useState<string | null>(null);
    const [goalkeeperIcon, setGoalkeeperIcon] = useState<string | null>(null);
    const [assistIcon,     setAssistIcon]     = useState<string | null>(null);
    const [ownGoalIcon,    setOwnGoalIcon]    = useState<string | null>(null);
    const [mvpIcon,        setMvpIcon]        = useState<string | null>(null);
    const [playerIcon,     setPlayerIcon]     = useState<string | null>(null);
    const [rank1Icon,      setRank1Icon]      = useState<string | null>(null);
    const [rank2Icon,      setRank2Icon]      = useState<string | null>(null);
    const [rank3Icon,      setRank3Icon]      = useState<string | null>(null);

    // ── status ─────────────────────────────────────────────────────
    const [isPersisted, setIsPersisted] = useState(false);
    const [loading, setLoading]         = useState(false);
    const [saving, setSaving]           = useState(false);
    const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);

    // ── admins ─────────────────────────────────────────────────────
    const [group, setGroup]             = useState<GroupDetailDto | null>(null);
    const [loadingAdmins, setLoadingAdmins] = useState(false);
    const [removingId, setRemovingId]   = useState<string | null>(null);
    const [addAdminOpen, setAddAdminOpen] = useState(false);

    // ── financeiros ────────────────────────────────────────────────
    const [removingFinanceiroId, setRemovingFinanceiroId] = useState<string | null>(null);
    const [addFinanceiroOpen, setAddFinanceiroOpen]       = useState(false);

    // ── confirmação ────────────────────────────────────────────────
    const [confirm, setConfirm]             = useState<ConfirmState | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    // ── load settings ──────────────────────────────────────────────
    async function load() {
        if (!groupId) return;
        setLoading(true);
        setMsg(null);
        try {
            const res = await GroupSettingsApi.get(groupId);
            const gs = res.data.data as any;
            if (gs) {
                setMinPlayers(gs.minPlayers ?? 5);
                setMaxPlayers(gs.maxPlayers ?? 6);
                setDefaultPlaceName(gs.defaultPlaceName ?? '');
                setDefaultDayOfWeek(
                    gs.defaultDayOfWeek != null ? String(gs.defaultDayOfWeek) : ''
                );
                setDefaultKickoffTime(
                    gs.defaultKickoffTime ? gs.defaultKickoffTime.slice(0, 5) : ''
                );
                setIsPersisted(gs.isPersisted ?? false);
                setGoalIcon(gs.goalIcon ?? null);
                setGoalkeeperIcon(gs.goalkeeperIcon ?? null);
                setAssistIcon(gs.assistIcon ?? null);
                setOwnGoalIcon(gs.ownGoalIcon ?? null);
                setMvpIcon(gs.mvpIcon ?? null);
                setPlayerIcon(gs.playerIcon ?? null);
                setRank1Icon(gs.rank1Icon ?? null);
                setRank2Icon(gs.rank2Icon ?? null);
                setRank3Icon(gs.rank3Icon ?? null);
                setPaymentMode(gs.paymentMode ?? 0);
                setMonthlyFee(gs.monthlyFee != null ? String(gs.monthlyFee) : '');
                setGoalkeeperMonthlyFee(gs.goalkeeperMonthlyFee != null ? String(gs.goalkeeperMonthlyFee) : '');
                setMvpTieRule(gs.mvpTieRule ?? 1);
                setMvpTieMaxPlayers(gs.mvpTieMaxPlayers ?? 2);
                setShowPlayerStats(gs.showPlayerStats ?? false);
                setPaymentDueDay(gs.paymentDueDay ?? null);
                setAutoFinalizeMvpHours(gs.autoFinalizeMvpHours ?? null);
                setMatchSchedulingEnabled(gs.matchSchedulingEnabled ?? false);
                setMatchSchedulingMode(gs.matchSchedulingMode ?? 0);
                setMatchScheduleDayOfWeek(gs.matchScheduleDayOfWeek != null ? String(gs.matchScheduleDayOfWeek) : '');
                setMatchScheduleTime(gs.matchScheduleTime ? gs.matchScheduleTime.slice(0, 5) : '');
                setManualMatchSchedules(Array.isArray(gs.manualMatchSchedules) ? gs.manualMatchSchedules : []);
            }
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao carregar configurações.'));
        } finally {
            setLoading(false);
        }
    }

    // ── load group / admins ────────────────────────────────────────
    async function loadGroup() {
        if (!groupId) return;
        setLoadingAdmins(true);
        try {
            const res = await GroupsApi.get(groupId);
            const raw = res.data.data as GroupDetailDto;

            // Se o backend já retornou adminUsers com dados, usa direto.
            // Caso contrário, busca cada usuário em paralelo pelos IDs.
            const hasNames =
                raw.adminUsers &&
                raw.adminUsers.length > 0 &&
                raw.adminUsers.some((u) => u.firstName || u.lastName || u.userName);

            const fetchUsers = async (ids: string[]): Promise<AdminUser[]> =>
                Promise.all(ids.map(async (id) => {
                    try {
                        const r = await UsersApi.get(id);
                        const u = r.data.data as UserResult;
                        return { userId: id, userName: u.userName ?? null, firstName: u.firstName ?? null, lastName: u.lastName ?? null } satisfies AdminUser;
                    } catch {
                        return { userId: id } satisfies AdminUser;
                    }
                }));

            if (hasNames) {
                const finIds = raw.financeiroIds ?? [];
                const finUsers = await fetchUsers(finIds);
                setGroup({ ...raw, financeiroUsers: finUsers });
            } else {
                const [adminUsers, finUsers] = await Promise.all([
                    fetchUsers(raw.adminIds ?? []),
                    fetchUsers(raw.financeiroIds ?? []),
                ]);
                setGroup({ ...raw, adminUsers, financeiroUsers: finUsers });
            }
        } catch {
            // silencioso — seção exibirá estado vazio
        } finally {
            setLoadingAdmins(false);
        }
    }

    // ── save settings ──────────────────────────────────────────────
    function addManualSchedule() {
        if (!manualScheduleDate || !manualScheduleTime) return;
        const playedAt = `${manualScheduleDate}T${manualScheduleTime}:00`;
        setManualMatchSchedules((items) => [
            ...items,
            { playedAt, created: false, matchId: null },
        ].sort((a, b) => a.playedAt.localeCompare(b.playedAt)));
        setManualScheduleDate('');
        setManualScheduleTime('');
    }

    function removeManualSchedule(index: number) {
        setManualMatchSchedules((items) => items.filter((_, i) => i !== index));
    }

    function editManualSchedule(index: number) {
        const item = manualMatchSchedules[index];
        if (!item || item.created) return;

        const [date = '', rawTime = ''] = item.playedAt.split('T');
        setManualScheduleDate(date);
        setManualScheduleTime(rawTime.slice(0, 5));
        setManualMatchSchedules((items) => items.filter((_, i) => i !== index));
    }

    async function startEditCreatedMatch(matchId: string, fallback?: { playedAt?: string; placeName?: string | null; scheduleIndex?: number | null }) {
        if (!groupId) return;
        if (!matchId) return;

        try {
            const res = await MatchesApi.get(groupId, matchId);
            const match = res.data.data as any;
            const playedAt = (match?.playedAt ?? fallback?.playedAt ?? '') as string;
            const [date = '', rawTime = ''] = playedAt.split('T');
            setMatchEdit({
                scheduleIndex: fallback?.scheduleIndex ?? null,
                matchId,
                placeName: match?.placeName ?? fallback?.placeName ?? defaultPlaceName ?? '',
                date,
                time: rawTime.slice(0, 5),
            });
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao carregar partida.'));
        }
    }

    async function saveCreatedMatchEdit() {
        if (!groupId || !matchEdit) return;
        const placeName = matchEdit.placeName.trim();
        if (!placeName || !matchEdit.date || !matchEdit.time) {
            toast.error('Informe local, data e horario da partida.');
            return;
        }

        const playedAt = `${matchEdit.date}T${matchEdit.time}:00`;
        setSavingMatchEdit(true);
        try {
            await MatchesApi.update(groupId, matchEdit.matchId, { placeName, playedAt } as any);
            if (matchEdit.scheduleIndex != null) {
                setManualMatchSchedules((items) => items.map((item, index) =>
                    index === matchEdit.scheduleIndex ? { ...item, playedAt } : item
                ));
            }
            setMatchEdit(null);
            toast.success('Partida atualizada.');
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao atualizar partida.'));
        } finally {
            setSavingMatchEdit(false);
        }
    }

    function formatManualSchedule(value: string) {
        const [date = '', rawTime = ''] = value.split('T');
        const [year, month, day] = date.split('-');
        return `${day ?? '--'}/${month ?? '--'}/${year ?? '----'} ${rawTime.slice(0, 5)}`;
    }

    async function save() {
        if (!groupId) return;
        setMsg(null);
        setSaving(true);
        try {
            await GroupSettingsApi.upsert(groupId, {
                minPlayers,
                maxPlayers,
                defaultPlaceName: defaultPlaceName.trim() || null,
                defaultDayOfWeek: defaultDayOfWeek !== '' ? Number(defaultDayOfWeek) : null,
                defaultKickoffTime: defaultKickoffTime ? `${defaultKickoffTime}:00` : null,
                goalIcon,
                goalkeeperIcon,
                assistIcon,
                ownGoalIcon,
                mvpIcon,
                playerIcon,
                rank1Icon,
                rank2Icon,
                rank3Icon,
                paymentMode,
                monthlyFee: paymentMode === 0 && monthlyFee !== '' ? parseFloat(monthlyFee) : null,
                goalkeeperMonthlyFee: paymentMode === 0 && goalkeeperMonthlyFee !== '' ? parseFloat(goalkeeperMonthlyFee) : null,
                mvpTieRule,
                mvpTieMaxPlayers: mvpTieRule === 2 ? mvpTieMaxPlayers : undefined,
                showPlayerStats,
                paymentDueDay: paymentMode === 0 ? paymentDueDay : null,
                autoFinalizeMvpHours,
                matchSchedulingEnabled,
                matchSchedulingMode,
                matchScheduleDayOfWeek: matchSchedulingMode === 1 && matchScheduleDayOfWeek !== '' ? Number(matchScheduleDayOfWeek) : null,
                matchScheduleTime: matchSchedulingMode === 1 && matchScheduleTime ? `${matchScheduleTime}:00` : null,
                manualMatchSchedules: manualMatchSchedules.map((item) => ({
                    playedAt: item.playedAt,
                    created: item.created ?? false,
                    matchId: item.matchId ?? null,
                })),
            } as any);
            setIsPersisted(true);
            setMsg({ text: 'Configurações salvas com sucesso.', ok: true });
            invalidateGroupIcons(groupId);
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao salvar configurações.'));
        } finally {
            setSaving(false);
        }
    }

    // ── remove admin ───────────────────────────────────────────────
    function handleRemoveAdmin(userId: string, displayName: string) {
        if (!groupId) return;
        setConfirm({
            label: `Remover "${displayName}" como administrador desta patota?`,
            onConfirm: async () => {
                setRemovingId(userId);
                try {
                    const res = await GroupsApi.removeAdmin(groupId, userId);
                    if (res.data.message) toast.success(res.data.message);
                    await loadGroup();
                } catch (e) {
                    toast.error(getResponseMessage(e, 'Erro ao remover administrador.'));
                } finally {
                    setRemovingId(null);
                }
            },
        });
    }

    function handleRemoveFinanceiro(userId: string, displayName: string) {
        if (!groupId) return;
        setConfirm({
            label: `Remover "${displayName}" como financeiro desta patota?`,
            onConfirm: async () => {
                setRemovingFinanceiroId(userId);
                try {
                    const res = await GroupsApi.removeFinanceiro(groupId, userId);
                    if (res.data.message) toast.success(res.data.message);
                    await loadGroup();
                } catch (e) {
                    toast.error(getResponseMessage(e, 'Erro ao remover financeiro.'));
                } finally {
                    setRemovingFinanceiroId(null);
                }
            },
        });
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

    useEffect(() => {
        load();
        loadGroup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    if (!groupId) {
        return (
            <div className="space-y-6">
                <Section title="Configurações do Grupo">
                    <div className="muted">Selecione um grupo no Dashboard.</div>
                </Section>
            </div>
        );
    }

    // createdByUserId pode não existir no payload atual — usamos fallback seguro
    const createdByUserId = group?.createdByUserId ?? null;

    // adminUsers é sempre populado por loadGroup (com dados buscados do backend)
    const adminList: AdminUser[] = group?.adminUsers ?? [];
    const existingAdminUserIds = new Set<string>(group?.adminIds ?? []);

    const financeiroList: AdminUser[] = group?.financeiroUsers ?? [];
    const existingFinanceiroUserIds = new Set<string>(group?.financeiroIds ?? []);

    return (
        <div className="space-y-6 pb-10 max-w-5xl">

            {/* ── Header ───────────────────────────────────────── */}
            <div className="page-header">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />
                <div className="relative flex items-center gap-3">
                    <div className="page-header-icon">
                        <Settings size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black leading-tight tracking-tight">
                            {group?.name ?? 'Configurações'}
                        </h1>
                        <p className="text-xs text-white/60 mt-0.5">Configure regras, ícones e gerencie a equipe da patota.</p>
                    </div>
                </div>
            </div>

            {/* ── Configurações ────────────────────────────────── */}
            <div className="card p-0 overflow-hidden shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Settings size={14} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">Configurações</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">Regras, pagamento, MVP e ícones da patota</div>
                    </div>
                </div>
                <div className="p-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-400 py-4">
                        <Loader2 size={16} className="animate-spin" /> Carregando…
                    </div>
                ) : (
                    <div className="space-y-5">

                        {/* ── Tab bar ── */}
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl gap-1">
                            {(['Geral', 'Pagamento', 'MVP', 'Ícones'] as const).map((tab, i) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(i)}
                                    className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === i
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* ── Tab 0: Geral ── */}
                        {activeTab === 0 && (
                            <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Jogadores */}
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <Users size={17} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Jogadores</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500">Por partida</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Mínimo">
                                                <input className="input" type="number" min={2} max={maxPlayers} value={minPlayers}
                                                    onChange={(e) => setMinPlayers(Number(e.target.value))} />
                                            </Field>
                                            <Field label="Máximo">
                                                <input className="input" type="number" min={minPlayers} value={maxPlayers}
                                                    onChange={(e) => setMaxPlayers(Number(e.target.value))} />
                                            </Field>
                                        </div>
                                    </div>
                                    {/* Padrões */}
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                                <CalendarClock size={17} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Padrões</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500">Local, dia e horário</div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <Field label="Local padrão">
                                                <input className="input" type="text" placeholder="Ex: Boca Jrs" maxLength={120}
                                                    value={defaultPlaceName} onChange={(e) => setDefaultPlaceName(e.target.value)} />
                                            </Field>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Dia">
                                                    <select className="input" value={defaultDayOfWeek}
                                                        onChange={(e) => setDefaultDayOfWeek(e.target.value)}>
                                                        {DAY_OPTIONS.map((o) => (
                                                            <option key={o.value} value={o.value}>{o.label}</option>
                                                        ))}
                                                    </select>
                                                </Field>
                                                <Field label="Horário">
                                                    <input className="input" type="time" value={defaultKickoffTime}
                                                        onChange={(e) => setDefaultKickoffTime(e.target.value)} />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                                                <CalendarClock size={17} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Agendar inicio das partidas</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500">Crie partidas manualmente ou por recorrencia usando os padroes acima.</div>
                                            </div>
                                        </div>
                                        <button type="button" role="switch" aria-checked={matchSchedulingEnabled}
                                            onClick={() => setMatchSchedulingEnabled((v) => !v)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${matchSchedulingEnabled ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${matchSchedulingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {matchSchedulingEnabled && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                {[{ val: 0, label: 'Manual' }, { val: 1, label: 'Recorrente' }].map(({ val, label }) => (
                                                    <label key={val} className={`flex items-center justify-center p-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium select-none ${matchSchedulingMode === val ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                        <input type="radio" name="matchSchedulingMode" value={val} checked={matchSchedulingMode === val} onChange={() => setMatchSchedulingMode(val)} className="sr-only" />
                                                        {label}
                                                    </label>
                                                ))}
                                            </div>

                                            {matchSchedulingMode === 0 ? (
                                                <div className="space-y-3">
                                                    <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                                        <Field label="Data">
                                                            <input className="input" type="date" value={manualScheduleDate} onChange={(e) => setManualScheduleDate(e.target.value)} />
                                                        </Field>
                                                        <Field label="Horario">
                                                            <input className="input" type="time" value={manualScheduleTime} onChange={(e) => setManualScheduleTime(e.target.value)} />
                                                        </Field>
                                                        <button type="button" onClick={addManualSchedule} disabled={!manualScheduleDate || !manualScheduleTime}
                                                            className="h-10 rounded-lg bg-slate-900 text-white px-4 text-sm font-semibold disabled:opacity-40 dark:bg-white dark:text-slate-900">
                                                            Adicionar
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {manualMatchSchedules.length === 0 ? (
                                                            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-400 text-center">
                                                                Nenhuma partida manual agendada.
                                                            </div>
                                                        ) : manualMatchSchedules.map((item, index) => (
                                                            <div key={`${item.playedAt}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                                                <div>
                                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{formatManualSchedule(item.playedAt)}</div>
                                                                    <div className="text-xs text-slate-400">{item.created ? 'Partida criada. Remover aqui nao exclui a partida.' : 'Aguardando horario'}</div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button type="button" onClick={() => editManualSchedule(index)} disabled={item.created}
                                                                        className="rounded-lg border border-slate-200 text-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
                                                                        Editar
                                                                    </button>
                                                                    {item.created && item.matchId && (
                                                                        <button type="button" onClick={() => startEditCreatedMatch(item.matchId!, { playedAt: item.playedAt, placeName: defaultPlaceName, scheduleIndex: index })}
                                                                            title="Alterar partida"
                                                                            aria-label="Alterar partida"
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                            <Pencil size={15} />
                                                                        </button>
                                                                    )}
                                                                    <button type="button" onClick={() => removeManualSchedule(index)}
                                                                        className="rounded-lg border border-rose-200 text-rose-600 px-3 py-1.5 text-xs font-semibold hover:bg-rose-50">
                                                                        Remover
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {matchEdit && (
                                                            <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900 p-4 space-y-3">
                                                                <div>
                                                                    <div className="text-sm font-bold text-slate-900 dark:text-white">Alterar partida criada</div>
                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">Atualiza local, data e horario da partida no sistema.</div>
                                                                </div>
                                                                <Field label="Local">
                                                                    <input className="input" value={matchEdit.placeName}
                                                                        onChange={(e) => setMatchEdit((prev) => prev ? { ...prev, placeName: e.target.value } : prev)} />
                                                                </Field>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <Field label="Data">
                                                                        <input className="input" type="date" value={matchEdit.date}
                                                                            onChange={(e) => setMatchEdit((prev) => prev ? { ...prev, date: e.target.value } : prev)} />
                                                                    </Field>
                                                                    <Field label="Horario">
                                                                        <input className="input" type="time" value={matchEdit.time}
                                                                            onChange={(e) => setMatchEdit((prev) => prev ? { ...prev, time: e.target.value } : prev)} />
                                                                    </Field>
                                                                </div>
                                                                <div className="flex gap-2 justify-end">
                                                                    <button type="button" onClick={() => setMatchEdit(null)}
                                                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                                        Cancelar
                                                                    </button>
                                                                    <button type="button" onClick={saveCreatedMatchEdit} disabled={savingMatchEdit}
                                                                        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-white dark:text-slate-900">
                                                                        {savingMatchEdit ? 'Salvando...' : 'Salvar partida'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid md:grid-cols-2 gap-3">
                                                    <Field label="Criar automaticamente em">
                                                        <select className="input" value={matchScheduleDayOfWeek}
                                                            onChange={(e) => setMatchScheduleDayOfWeek(e.target.value)}>
                                                            {DAY_OPTIONS.map((o) => (
                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                            ))}
                                                        </select>
                                                    </Field>
                                                    <Field label="Horario do agendamento">
                                                        <input className="input" type="time" value={matchScheduleTime}
                                                            onChange={(e) => setMatchScheduleTime(e.target.value)} />
                                                    </Field>
                                                    <p className="md:col-span-2 text-xs text-slate-400 dark:text-slate-500">
                                                        No horario agendado, o sistema cria a proxima partida usando local, dia e horario padrao configurados acima.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Exibir stats */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                <BarChart2 size={17} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Exibir gols e assistências</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500">Jogadores comuns poderão ver gols e assistências. Admins sempre visualizam.</div>
                                            </div>
                                        </div>
                                        <button type="button" role="switch" aria-checked={showPlayerStats}
                                            onClick={() => setShowPlayerStats((v) => !v)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${showPlayerStats ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${showPlayerStats ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Tab 1: Pagamento ── */}
                        {activeTab === 1 && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                        <DollarSign size={17} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Pagamento</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500">Modo de cobrança</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        {[{ val: 0, label: 'Mensal' }, { val: 1, label: 'Por jogo' }].map(({ val, label }) => (
                                            <label key={val} className={`flex items-center justify-center p-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium select-none ${paymentMode === val ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                <input type="radio" name="paymentMode" value={val} checked={paymentMode === val} onChange={() => setPaymentMode(val)} className="sr-only" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                    {paymentMode === 0 && (
                                        <>
                                            <Field label="Mensalidade Jogador (R$)">
                                                <input className="input" type="number" min={0} step={0.01} placeholder="Ex: 50.00" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
                                            </Field>
                                            <Field label="Mensalidade Goleiro (R$)">
                                                <input className="input" type="number" min={0} step={0.01} placeholder="Padrão: igual ao jogador" value={goalkeeperMonthlyFee} onChange={(e) => setGoalkeeperMonthlyFee(e.target.value)} />
                                            </Field>
                                            <Field label="Dia de vencimento">
                                                <select className="input" value={paymentDueDay ?? ''} onChange={(e) => setPaymentDueDay(e.target.value !== '' ? Number(e.target.value) : null)}>
                                                    <option value="">Sem lembrete</option>
                                                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                                        <option key={d} value={d}>Dia {d}</option>
                                                    ))}
                                                </select>
                                                {paymentDueDay != null && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Lembrete enviado no dia&nbsp;1 e no dia&nbsp;{paymentDueDay} para quem ainda não pagou.</p>
                                                )}
                                            </Field>
                                        </>
                                    )}
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                        {paymentMode === 0 ? 'Cobrado mensalmente ao encerrar uma partida.' : 'O financeiro define o valor ao encerrar cada partida.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Tab 2: MVP ── */}
                        {activeTab === 2 && (
                            <div className="space-y-4">
                                {/* Empate */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0">
                                            <Trophy size={17} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">Empate no MVP</div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500">O que acontece quando dois ou mais jogadores empatam em votos</div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {([
                                            { val: 0, label: 'Nenhum recebe MVP', desc: 'Em caso de empate, ninguém é eleito.' },
                                            { val: 1, label: 'Todos recebem MVP', desc: 'Todos os empatados são eleitos MVPs.' },
                                            { val: 2, label: 'Todos até um máximo', desc: 'Todos recebem MVP se o número de empatados não ultrapassar o limite.' },
                                        ] as { val: number; label: string; desc: string }[]).map(({ val, label, desc }) => (
                                            <label key={val} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all select-none ${mvpTieRule === val ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                <input type="radio" name="mvpTieRule" value={val} checked={mvpTieRule === val} onChange={() => setMvpTieRule(val)} className="sr-only" />
                                                <div className="pt-0.5">
                                                    <div className="text-sm font-medium leading-tight">{label}</div>
                                                    <div className={`text-xs mt-0.5 leading-relaxed ${mvpTieRule === val ? 'opacity-70' : 'text-slate-400 dark:text-slate-500'}`}>{desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {mvpTieRule === 2 && (
                                        <Field label="Máximo de MVPs empatados">
                                            <input className="input" type="number" min={2} max={22} value={mvpTieMaxPlayers} onChange={(e) => setMvpTieMaxPlayers(Math.max(2, Number(e.target.value)))} />
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Se {mvpTieMaxPlayers} ou menos jogadores empatarem, todos recebem MVP. Se ultrapassar, ninguém recebe.</p>
                                        </Field>
                                    )}
                                </div>
                                {/* Auto-finalize */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">Encerrar votação MVP automaticamente</div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500">Finaliza a partida após um tempo configurado</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {autoFinalizeMvpHours != null ? `A partida será finalizada automaticamente ${autoFinalizeMvpHours}h após ser encerrada. Um lembrete é enviado 1h antes.` : 'Desativado — o admin finaliza manualmente quando quiser.'}
                                        </p>
                                        <button type="button" role="switch" aria-checked={autoFinalizeMvpHours != null}
                                            onClick={() => setAutoFinalizeMvpHours(autoFinalizeMvpHours != null ? null : 2)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${autoFinalizeMvpHours != null ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${autoFinalizeMvpHours != null ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    {autoFinalizeMvpHours != null && (
                                        <Field label="Horas para encerrar após fim da partida">
                                            <input className="input" type="number" min={1} max={48} value={autoFinalizeMvpHours} onChange={(e) => setAutoFinalizeMvpHours(Math.max(1, Number(e.target.value)))} />
                                        </Field>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Tab 3: Ícones ── */}
                        {activeTab === 3 && (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { label: 'Gol',         value: goalIcon,       def: DEFAULT_ICONS.goalIcon,       opts: GOAL_OPTIONS,       set: setGoalIcon },
                                    { label: 'Goleiro',     value: goalkeeperIcon, def: DEFAULT_ICONS.goalkeeperIcon, opts: GOALKEEPER_OPTIONS, set: setGoalkeeperIcon },
                                    { label: 'Assistência', value: assistIcon,     def: DEFAULT_ICONS.assistIcon,     opts: ASSIST_OPTIONS,     set: setAssistIcon },
                                    { label: 'Gol contra',  value: ownGoalIcon,    def: DEFAULT_ICONS.ownGoalIcon,    opts: OWN_GOAL_OPTIONS,   set: setOwnGoalIcon },
                                    { label: 'MVP',         value: mvpIcon,        def: DEFAULT_ICONS.mvpIcon,        opts: MVP_OPTIONS,        set: setMvpIcon },
                                    { label: 'Jogador',     value: playerIcon,     def: DEFAULT_ICONS.playerIcon,     opts: PLAYER_OPTIONS,     set: setPlayerIcon },
                                    { label: '1º lugar',    value: rank1Icon,      def: DEFAULT_ICONS.rank1Icon,      opts: RANK_OPTIONS,       set: setRank1Icon },
                                    { label: '2º lugar',    value: rank2Icon,      def: DEFAULT_ICONS.rank2Icon,      opts: RANK_OPTIONS,       set: setRank2Icon },
                                    { label: '3º lugar',    value: rank3Icon,      def: DEFAULT_ICONS.rank3Icon,      opts: RANK_OPTIONS,       set: setRank3Icon },
                                ].map(({ label, value, def, opts, set }) => (
                                    <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50 p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                <IconRenderer value={value ?? def} size={22} />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                                        </div>
                                        <IconPicker options={opts} value={value} onChange={set} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Salvar ── */}
                        <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button className="btn btn-primary flex items-center gap-2 px-6" onClick={save} disabled={saving || loading}>
                                {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Save size={15} /> Salvar configurações</>}
                            </button>
                            {msg && <span className={`text-sm font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.ok ? '✓ ' : '✕ '}{msg.text}</span>}
                            {!isPersisted && !msg && (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle size={13} /> Usando valores padrão — salve para persistir.
                                </span>
                            )}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* ── Equipe da patota ─────────────────────────────── */}
            <div className="card p-0 overflow-hidden shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0">
                        <Users size={15} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">Equipe da patota</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">Administradores e responsáveis financeiros</div>
                    </div>
                </div>
                <div className="p-6">

                {/* Aviso: sem financeiro */}
                {!loadingAdmins && financeiroList.length === 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
                        <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-700">
                            <span className="font-semibold">Sem financeiro cadastrado.</span>{' '}
                            Nenhum usuário pode gerenciar pagamentos desta patota enquanto não houver um financeiro.
                        </p>
                    </div>
                )}

                {loadingAdmins ? (
                    <div className="flex items-center gap-2 text-slate-400 py-4">
                        <Loader2 size={16} className="animate-spin" /> Carregando…
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-5">

                        {/* ── Coluna Admins ── */}
                        <div className="rounded-xl border border-violet-200 dark:border-slate-700 bg-gradient-to-b from-violet-50/60 to-white dark:from-slate-800/80 dark:to-slate-900 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                                        <Shield size={13} />
                                    </div>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Administradores</span>
                                    <span className="text-xs font-semibold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">{adminList.length}</span>
                                </div>
                                <button type="button"
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors font-medium shadow-sm"
                                    onClick={() => setAddAdminOpen(true)}>
                                    <ShieldPlus size={12} /> Adicionar
                                </button>
                            </div>

                            {adminList.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-4 text-center">Nenhum administrador.</p>
                            ) : (
                                <div className="space-y-2">
                                    {adminList.map((admin) => {
                                        const isCreator     = createdByUserId && admin.userId === createdByUserId;
                                        const isCurrentUser = admin.userId === currentUserId;
                                        const isRemoving    = removingId === admin.userId;
                                        const isAlsoFin     = existingFinanceiroUserIds.has(admin.userId);
                                        const displayName   = fullName(admin);
                                        return (
                                            <div key={admin.userId}
                                                className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white dark:bg-slate-900 dark:border-slate-700 px-3 py-2.5 shadow-sm dark:shadow-none">
                                                <div className="h-9 w-9 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                    {initials(admin)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5 flex-wrap">
                                                        {displayName}
                                                        {isCurrentUser && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none font-normal shrink-0">Você</span>
                                                        )}
                                                        {isAlsoFin && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 leading-none font-medium shrink-0 flex items-center gap-0.5">
                                                                <Wallet size={9} /> Fin.
                                                            </span>
                                                        )}
                                                    </div>
                                                    {admin.userName && <div className="text-xs text-slate-400 dark:text-slate-500">@{admin.userName}</div>}
                                                </div>
                                                {isCreator ? (
                                                    <span className="text-[11px] px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium shrink-0">Criador</span>
                                                ) : (
                                                    <button type="button" disabled={isRemoving}
                                                        onClick={() => handleRemoveAdmin(admin.userId, displayName)}
                                                        title={`Remover ${displayName} dos admins`}
                                                        className="h-7 w-7 flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 bg-white dark:bg-slate-800 dark:border-slate-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shrink-0">
                                                        {isRemoving
                                                            ? <Loader2 size={12} className="animate-spin" />
                                                            : <ShieldOff size={13} />}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed pt-1">
                                Gerenciam jogadores, partidas e configurações. O criador não pode ser removido.
                            </p>
                        </div>

                        {/* ── Coluna Financeiros ── */}
                        <div className="rounded-xl border border-emerald-200 dark:border-slate-700 bg-gradient-to-b from-emerald-50/60 to-white dark:from-slate-800/80 dark:to-slate-900 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                        <Wallet size={13} />
                                    </div>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Financeiros</span>
                                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">{financeiroList.length}</span>
                                </div>
                                <button type="button"
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors font-medium shadow-sm"
                                    onClick={() => setAddFinanceiroOpen(true)}>
                                    <Wallet size={12} /> Adicionar
                                </button>
                            </div>

                            {financeiroList.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-4 text-center">Nenhum financeiro cadastrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {financeiroList.map((fin) => {
                                        const isCurrentUser = fin.userId === currentUserId;
                                        const isRemoving    = removingFinanceiroId === fin.userId;
                                        const isAlsoAdmin   = existingAdminUserIds.has(fin.userId);
                                        const displayName   = fullName(fin);
                                        return (
                                            <div key={fin.userId}
                                                className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white dark:bg-slate-900 dark:border-slate-700 px-3 py-2.5 shadow-sm dark:shadow-none">
                                                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                    {initials(fin)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5 flex-wrap">
                                                        {displayName}
                                                        {isCurrentUser && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none font-normal shrink-0">Você</span>
                                                        )}
                                                        {isAlsoAdmin && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 leading-none font-medium shrink-0 flex items-center gap-0.5">
                                                                <Shield size={9} /> Adm.
                                                            </span>
                                                        )}
                                                    </div>
                                                    {fin.userName && <div className="text-xs text-slate-400 dark:text-slate-500">@{fin.userName}</div>}
                                                </div>
                                                <button type="button" disabled={isRemoving}
                                                    onClick={() => handleRemoveFinanceiro(fin.userId, displayName)}
                                                    title={`Remover ${displayName} dos financeiros`}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 bg-white dark:bg-slate-800 dark:border-slate-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shrink-0">
                                                    {isRemoving
                                                        ? <Loader2 size={12} className="animate-spin" />
                                                        : <ShieldOff size={13} />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed pt-1">
                                Gerenciam pagamentos, mensalidades e cobranças. Admins não têm acesso automático.
                            </p>
                        </div>

                    </div>
                )}
                </div>
            </div>

            {/* ── Modais ───────────────────────────────────────── */}
            <AddAdminModal
                open={addAdminOpen}
                onClose={() => setAddAdminOpen(false)}
                groupId={groupId}
                groupName={group?.name ?? ''}
                existingAdminUserIds={existingAdminUserIds}
                onAdded={loadGroup}
            />
            <AddFinanceiroModal
                open={addFinanceiroOpen}
                onClose={() => setAddFinanceiroOpen(false)}
                groupId={groupId}
                groupName={group?.name ?? ''}
                existingFinanceiroUserIds={existingFinanceiroUserIds}
                onAdded={loadGroup}
            />

            {/* ── Modal de confirmação ──────────────────────────── */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={() => setConfirm(null)}>
                    <div className="card p-6 w-full max-w-sm space-y-4 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700/50" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 text-rose-600">
                            <AlertTriangle size={22} />
                            <span className="font-semibold text-base">Confirmar remoção</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{confirm.label}</p>
                        <div className="flex gap-2 justify-end">
                            <button className="btn py-1.5 px-4 text-sm" onClick={() => setConfirm(null)}
                                disabled={confirmLoading} type="button">
                                Cancelar
                            </button>
                            <button
                                className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 font-medium"
                                onClick={runConfirm} disabled={confirmLoading} type="button">
                                {confirmLoading
                                    ? <><Loader2 size={14} className="animate-spin" /> Removendo…</>
                                    : 'Confirmar remoção'
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
