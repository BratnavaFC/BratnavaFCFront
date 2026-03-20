import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ShieldOff, ShieldPlus, Shield, Search, Check, X, AlertTriangle, Wallet, Users, Settings, CalendarClock, CreditCard, AlertCircle, Save } from 'lucide-react';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { GroupSettingsApi, GroupsApi, UsersApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { extractApiError } from '../lib/apiError';
import { isGodMode } from '../auth/guards';
import { IconPicker } from '../components/IconPicker';
import { IconRenderer } from '../components/IconRenderer';
import { invalidateGroupIcons } from '../hooks/useGroupIcons';
import {
    GOAL_OPTIONS, GOALKEEPER_OPTIONS, ASSIST_OPTIONS,
    OWN_GOAL_OPTIONS, MVP_OPTIONS, PLAYER_OPTIONS, DEFAULT_ICONS,
} from '../lib/groupIcons';

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

// ─── AddAdminModal ────────────────────────────────────────────────────────────

function AddAdminModal({
    open,
    onClose,
    groupId,
    groupName,
    existingAdminUserIds,
    onAdded,
}: {
    open: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    existingAdminUserIds: Set<string>;
    onAdded: () => void;
}) {
    const [query, setQuery]         = useState('');
    const [results, setResults]     = useState<UserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [added, setAdded]         = useState<Set<string>>(new Set());
    const [adding, setAdding]       = useState<Record<string, boolean>>({});
    const [addErr, setAddErr]       = useState<Record<string, string>>({});
    const [searchErr, setSearchErr] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setAdded(new Set());
            setAdding({});
            setAddErr({});
            setSearchErr(null);
        }
    }, [open]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) { setResults([]); setSearchErr(null); return; }
        const timer = setTimeout(async () => {
            setSearching(true);
            setSearchErr(null);
            try {
                const res = await UsersApi.list({ search: q, pageSize: 8 });
                setResults(res.data?.items ?? []);
            } catch {
                setSearchErr('Erro ao buscar usuários.');
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    async function handleAdd(user: UserResult) {
        setAdding((prev) => ({ ...prev, [user.id]: true }));
        setAddErr((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
        try {
            await GroupsApi.addAdmin(groupId, user.id);
            setAdded((prev) => new Set(prev).add(user.id));
            onAdded();
        } catch (e) {
            const msg = extractApiError(e, 'Erro ao adicionar admin.');
            setAddErr((prev) => ({ ...prev, [user.id]: msg }));
        } finally {
            setAdding((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
        }
    }

    if (!open) return null;

    const q = query.trim();
    const showResults = q.length >= 2;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border overflow-hidden flex flex-col max-h-[85vh]">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                                <ShieldPlus size={17} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Adicionar admin</div>
                                <div className="text-xs text-slate-500 truncate max-w-[220px]">{groupName}</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                            aria-label="Fechar"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* search input */}
                    <div className="px-5 pt-4 pb-3 shrink-0">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                className="input w-full pl-9 pr-9"
                                placeholder="Buscar por nome ou username..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                            {searching && (
                                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none" />
                            )}
                        </div>
                    </div>

                    {/* results */}
                    <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                        {!showResults ? (
                            <p className="text-sm text-slate-400 text-center py-6">
                                {q.length === 1 ? 'Continue digitando...' : 'Digite para buscar usuários.'}
                            </p>
                        ) : searchErr ? (
                            <p className="text-sm text-rose-500 text-center py-6">{searchErr}</p>
                        ) : searching ? null : results.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">
                                Nenhum usuário encontrado para "{query}".
                            </p>
                        ) : (
                            results.map((u) => {
                                const isAlreadyAdmin = existingAdminUserIds.has(u.id);
                                const isAdded        = added.has(u.id);
                                const isAdding       = !!adding[u.id];
                                const err            = addErr[u.id];
                                return (
                                    <div key={u.id} className="space-y-1">
                                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                {initials(u)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 truncate">{fullName(u)}</div>
                                                <div className="text-xs text-slate-400">@{u.userName}</div>
                                            </div>
                                            {isAlreadyAdmin ? (
                                                <span className="text-xs font-medium text-slate-400 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
                                                    Já é admin
                                                </span>
                                            ) : isAdded ? (
                                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 shrink-0">
                                                    <Check size={13} /> Adicionado
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary text-xs px-3 py-1.5 shrink-0 flex items-center gap-1.5"
                                                    disabled={isAdding}
                                                    onClick={() => handleAdd(u)}
                                                >
                                                    {isAdding
                                                        ? <><Loader2 size={12} className="animate-spin" /> Adicionando...</>
                                                        : <><ShieldPlus size={13} /> Admin</>
                                                    }
                                                </button>
                                            )}
                                        </div>
                                        {err && <p className="text-xs text-rose-500 px-1">{err}</p>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── AddFinanceiroModal ───────────────────────────────────────────────────────

function AddFinanceiroModal({
    open,
    onClose,
    groupId,
    groupName,
    existingFinanceiroUserIds,
    onAdded,
}: {
    open: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    existingFinanceiroUserIds: Set<string>;
    onAdded: () => void;
}) {
    const [query, setQuery]         = useState('');
    const [results, setResults]     = useState<UserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [added, setAdded]         = useState<Set<string>>(new Set());
    const [adding, setAdding]       = useState<Record<string, boolean>>({});
    const [addErr, setAddErr]       = useState<Record<string, string>>({});
    const [searchErr, setSearchErr] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setAdded(new Set());
            setAdding({});
            setAddErr({});
            setSearchErr(null);
        }
    }, [open]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) { setResults([]); setSearchErr(null); return; }
        const timer = setTimeout(async () => {
            setSearching(true);
            setSearchErr(null);
            try {
                const res = await UsersApi.list({ search: q, pageSize: 8 });
                setResults(res.data?.items ?? []);
            } catch {
                setSearchErr('Erro ao buscar usuários.');
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    async function handleAdd(user: UserResult) {
        setAdding((prev) => ({ ...prev, [user.id]: true }));
        setAddErr((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
        try {
            await GroupsApi.addFinanceiro(groupId, user.id);
            setAdded((prev) => new Set(prev).add(user.id));
            onAdded();
        } catch (e) {
            const msg = extractApiError(e, 'Erro ao adicionar financeiro.');
            setAddErr((prev) => ({ ...prev, [user.id]: msg }));
        } finally {
            setAdding((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
        }
    }

    if (!open) return null;

    const q = query.trim();
    const showResults = q.length >= 2;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                                <Wallet size={17} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Adicionar financeiro</div>
                                <div className="text-xs text-slate-500 truncate max-w-[220px]">{groupName}</div>
                            </div>
                        </div>
                        <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center" aria-label="Fechar" type="button">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="px-5 pt-4 pb-3 shrink-0">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                className="input w-full pl-9 pr-9"
                                placeholder="Buscar por nome ou username..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none" />}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                        {!showResults ? (
                            <p className="text-sm text-slate-400 text-center py-6">
                                {q.length === 1 ? 'Continue digitando...' : 'Digite para buscar usuários.'}
                            </p>
                        ) : searchErr ? (
                            <p className="text-sm text-rose-500 text-center py-6">{searchErr}</p>
                        ) : searching ? null : results.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">Nenhum usuário encontrado para "{query}".</p>
                        ) : (
                            results.map((u) => {
                                const isAlready = existingFinanceiroUserIds.has(u.id);
                                const isAdded   = added.has(u.id);
                                const isAdding  = !!adding[u.id];
                                const err       = addErr[u.id];
                                return (
                                    <div key={u.id} className="space-y-1">
                                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                {initials(u)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 truncate">{fullName(u)}</div>
                                                <div className="text-xs text-slate-400">@{u.userName}</div>
                                            </div>
                                            {isAlready ? (
                                                <span className="text-xs font-medium text-slate-400 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">Já é financeiro</span>
                                            ) : isAdded ? (
                                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 shrink-0">
                                                    <Check size={13} /> Adicionado
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="text-xs px-3 py-1.5 shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50"
                                                    disabled={isAdding}
                                                    onClick={() => handleAdd(u)}
                                                >
                                                    {isAdding
                                                        ? <><Loader2 size={12} className="animate-spin" /> Adicionando...</>
                                                        : <><Wallet size={13} /> Financeiro</>
                                                    }
                                                </button>
                                            )}
                                        </div>
                                        {err && <p className="text-xs text-rose-500 px-1">{err}</p>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
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

    // ── pagamento ──────────────────────────────────────────────────
    /** 0 = Monthly, 1 = PerGame */
    const [paymentMode, setPaymentMode] = useState<number>(0);
    const [monthlyFee,  setMonthlyFee]  = useState<string>('');

    // ── ícones ─────────────────────────────────────────────────────
    const [goalIcon,       setGoalIcon]       = useState<string | null>(null);
    const [goalkeeperIcon, setGoalkeeperIcon] = useState<string | null>(null);
    const [assistIcon,     setAssistIcon]     = useState<string | null>(null);
    const [ownGoalIcon,    setOwnGoalIcon]    = useState<string | null>(null);
    const [mvpIcon,        setMvpIcon]        = useState<string | null>(null);
    const [playerIcon,     setPlayerIcon]     = useState<string | null>(null);

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
            const gs = res.data as any;
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
                setPaymentMode(gs.paymentMode ?? 0);
                setMonthlyFee(gs.monthlyFee != null ? String(gs.monthlyFee) : '');
            }
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao carregar configurações.'));
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
            const raw = res.data as GroupDetailDto;

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
                        const u = r.data as UserResult;
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
                paymentMode,
                monthlyFee: paymentMode === 0 && monthlyFee !== '' ? parseFloat(monthlyFee) : null,
            } as any);
            setIsPersisted(true);
            setMsg({ text: 'Configurações salvas com sucesso.', ok: true });
            invalidateGroupIcons(groupId);
        } catch (e) {
            toast.error(extractApiError(e, 'Erro ao salvar configurações.'));
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
                    await GroupsApi.removeAdmin(groupId, userId);
                    toast.success(`${displayName} removido dos administradores.`);
                    await loadGroup();
                } catch (e) {
                    toast.error(extractApiError(e, 'Erro ao remover administrador.'));
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
                    await GroupsApi.removeFinanceiro(groupId, userId);
                    toast.success(`${displayName} removido dos financeiros.`);
                    await loadGroup();
                } catch (e) {
                    toast.error(extractApiError(e, 'Erro ao remover financeiro.'));
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
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                        <Settings size={26} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-tight tracking-tight">
                            {group?.name ?? 'Configurações'}
                        </h1>
                        <p className="text-sm text-white/50 mt-0.5">Configure regras, ícones e gerencie a equipe da patota.</p>
                    </div>
                </div>
            </div>

            {/* ── Configurações gerais ──────────────────────────── */}
            <div className="card p-0 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Settings size={14} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900 text-sm">Configurações gerais</div>
                        <div className="text-xs text-slate-400">Regras de partidas e modo de cobrança</div>
                    </div>
                </div>
                <div className="p-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-400 py-4">
                        <Loader2 size={16} className="animate-spin" /> Carregando…
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-4">

                            {/* ── Jogadores ── */}
                            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                        <Users size={17} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Jogadores</div>
                                        <div className="text-xs text-slate-400">Por partida</div>
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

                            {/* ── Padrões de Partida ── */}
                            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                        <CalendarClock size={17} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Padrões</div>
                                        <div className="text-xs text-slate-400">Local, dia e horário</div>
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

                            {/* ── Pagamento ── */}
                            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                        <CreditCard size={17} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Pagamento</div>
                                        <div className="text-xs text-slate-400">Modo de cobrança</div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {[{ val: 0, label: 'Mensal' }, { val: 1, label: 'Por jogo' }].map(({ val, label }) => (
                                            <label key={val} className={`flex items-center justify-center p-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium select-none ${paymentMode === val ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <input type="radio" name="paymentMode" value={val} checked={paymentMode === val}
                                                    onChange={() => setPaymentMode(val)} className="sr-only" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                    {paymentMode === 0 && (
                                        <Field label="Mensalidade (R$)">
                                            <input className="input" type="number" min={0} step={0.01}
                                                placeholder="Ex: 50.00" value={monthlyFee}
                                                onChange={(e) => setMonthlyFee(e.target.value)} />
                                        </Field>
                                    )}
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {paymentMode === 0
                                            ? 'Cobrado mensalmente ao encerrar uma partida.'
                                            : 'O financeiro define o valor ao encerrar cada partida.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Salvar ── */}
                        <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                            <button
                                className="btn btn-primary flex items-center gap-2 px-6"
                                onClick={save}
                                disabled={saving || loading}
                            >
                                {saving
                                    ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
                                    : <><Save size={15} /> Salvar configurações</>
                                }
                            </button>
                            {msg && (
                                <span className={`text-sm font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {msg.ok ? '✓ ' : '✕ '}{msg.text}
                                </span>
                            )}
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

            {/* ── Ícones da patota ─────────────────────────────── */}
            <div className="card p-0 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="h-8 w-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 text-base leading-none">
                        ⚽
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900 text-sm">Ícones da patota</div>
                        <div className="text-xs text-slate-400">Personalize os ícones exibidos em toda a aplicação</div>
                    </div>
                </div>
                <div className="p-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                        { label: 'Gol',         value: goalIcon,        def: DEFAULT_ICONS.goalIcon,        opts: GOAL_OPTIONS,        set: setGoalIcon },
                        { label: 'Goleiro',     value: goalkeeperIcon,  def: DEFAULT_ICONS.goalkeeperIcon,  opts: GOALKEEPER_OPTIONS,  set: setGoalkeeperIcon },
                        { label: 'Assistência', value: assistIcon,      def: DEFAULT_ICONS.assistIcon,      opts: ASSIST_OPTIONS,      set: setAssistIcon },
                        { label: 'Gol contra',  value: ownGoalIcon,     def: DEFAULT_ICONS.ownGoalIcon,     opts: OWN_GOAL_OPTIONS,    set: setOwnGoalIcon },
                        { label: 'MVP',         value: mvpIcon,         def: DEFAULT_ICONS.mvpIcon,         opts: MVP_OPTIONS,         set: setMvpIcon },
                        { label: 'Jogador',     value: playerIcon,      def: DEFAULT_ICONS.playerIcon,      opts: PLAYER_OPTIONS,      set: setPlayerIcon },
                    ].map(({ label, value, def, opts, set }) => (
                        <div key={label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                    <IconRenderer value={value ?? def} size={22} />
                                </div>
                                <span className="text-sm font-semibold text-slate-800">{label}</span>
                            </div>
                            <IconPicker options={opts} value={value} onChange={set} />
                        </div>
                    ))}
                </div>
                </div>
            </div>

            {/* ── Equipe da patota ─────────────────────────────── */}
            <div className="card p-0 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="h-8 w-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0">
                        <Users size={15} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900 text-sm">Equipe da patota</div>
                        <div className="text-xs text-slate-400">Administradores e responsáveis financeiros</div>
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
                        <div className="rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50/60 to-white p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                                        <Shield size={13} />
                                    </div>
                                    <span className="font-semibold text-slate-800 text-sm">Administradores</span>
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
                                                className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white px-3 py-2.5 shadow-sm">
                                                <div className="h-9 w-9 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                    {initials(admin)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5 flex-wrap">
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
                                                    {admin.userName && <div className="text-xs text-slate-400">@{admin.userName}</div>}
                                                </div>
                                                {isCreator ? (
                                                    <span className="text-[11px] px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium shrink-0">Criador</span>
                                                ) : (
                                                    <button type="button" disabled={isRemoving}
                                                        onClick={() => handleRemoveAdmin(admin.userId, displayName)}
                                                        title={`Remover ${displayName} dos admins`}
                                                        className="h-7 w-7 flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 bg-white hover:bg-rose-50 transition-colors disabled:opacity-50 shrink-0">
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
                            <p className="text-xs text-slate-400 leading-relaxed pt-1">
                                Gerenciam jogadores, partidas e configurações. O criador não pode ser removido.
                            </p>
                        </div>

                        {/* ── Coluna Financeiros ── */}
                        <div className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                        <Wallet size={13} />
                                    </div>
                                    <span className="font-semibold text-slate-800 text-sm">Financeiros</span>
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
                                                className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2.5 shadow-sm">
                                                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                    {initials(fin)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5 flex-wrap">
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
                                                    {fin.userName && <div className="text-xs text-slate-400">@{fin.userName}</div>}
                                                </div>
                                                <button type="button" disabled={isRemoving}
                                                    onClick={() => handleRemoveFinanceiro(fin.userId, displayName)}
                                                    title={`Remover ${displayName} dos financeiros`}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 bg-white hover:bg-rose-50 transition-colors disabled:opacity-50 shrink-0">
                                                    {isRemoving
                                                        ? <Loader2 size={12} className="animate-spin" />
                                                        : <ShieldOff size={13} />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-xs text-slate-400 leading-relaxed pt-1">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <div className="card p-6 w-full max-w-sm space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-600">
                            <AlertTriangle size={22} />
                            <span className="font-semibold text-base">Confirmar remoção</span>
                        </div>
                        <p className="text-sm text-slate-700">{confirm.label}</p>
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
