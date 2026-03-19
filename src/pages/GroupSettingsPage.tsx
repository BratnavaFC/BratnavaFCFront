import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ShieldOff, ShieldPlus, Search, Check, X, AlertTriangle, Wallet } from 'lucide-react';
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
        <div className="space-y-6">

            {/* ── Configurações gerais ──────────────────────────── */}
            <Section title="Configurações do Grupo">
                {loading ? (
                    <div className="muted">Carregando…</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* ── Jogadores ──────────────────────────────────── */}
                        <div className="card p-4 space-y-4">
                            <div className="font-semibold text-slate-900">Jogadores por partida</div>

                            <Field label="Mínimo de jogadores">
                                <input
                                    className="input"
                                    type="number"
                                    min={2}
                                    max={maxPlayers}
                                    value={minPlayers}
                                    onChange={(e) => setMinPlayers(Number(e.target.value))}
                                />
                            </Field>

                            <Field label="Máximo de jogadores">
                                <input
                                    className="input"
                                    type="number"
                                    min={minPlayers}
                                    value={maxPlayers}
                                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                />
                            </Field>
                        </div>

                        {/* ── Padrões de Partida ─────────────────────────── */}
                        <div className="card p-4 space-y-4">
                            <div className="font-semibold text-slate-900">Padrões de partida</div>

                            <Field label="Local padrão">
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Ex: Boca Jrs"
                                    maxLength={120}
                                    value={defaultPlaceName}
                                    onChange={(e) => setDefaultPlaceName(e.target.value)}
                                />
                            </Field>

                            <Field label="Dia da semana padrão">
                                <select
                                    className="input"
                                    value={defaultDayOfWeek}
                                    onChange={(e) => setDefaultDayOfWeek(e.target.value)}
                                >
                                    {DAY_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Horário padrão">
                                <input
                                    className="input"
                                    type="time"
                                    value={defaultKickoffTime}
                                    onChange={(e) => setDefaultKickoffTime(e.target.value)}
                                />
                            </Field>
                        </div>

                        {/* ── Pagamento ──────────────────────────────────── */}
                        <div className="card p-4 space-y-4">
                            <div className="font-semibold text-slate-900">💰 Pagamento</div>

                            <Field label="Tipo de cobrança">
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="paymentMode"
                                            value="0"
                                            checked={paymentMode === 0}
                                            onChange={() => setPaymentMode(0)}
                                            className="accent-slate-900"
                                        />
                                        <span className="text-sm font-medium text-slate-800">Mensal</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="paymentMode"
                                            value="1"
                                            checked={paymentMode === 1}
                                            onChange={() => setPaymentMode(1)}
                                            className="accent-slate-900"
                                        />
                                        <span className="text-sm font-medium text-slate-800">Por jogo</span>
                                    </label>
                                </div>
                            </Field>

                            {paymentMode === 0 && (
                                <Field label="Valor da mensalidade (R$)">
                                    <input
                                        className="input"
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        placeholder="Ex: 50.00 (deixe vazio para desativar)"
                                        value={monthlyFee}
                                        onChange={(e) => setMonthlyFee(e.target.value)}
                                    />
                                </Field>
                            )}

                            <p className="text-xs text-slate-400">
                                {paymentMode === 0
                                    ? 'Modo mensal: jogadores com conta vinculada (não convidados) são cobrados uma vez por mês. O valor é lançado ao encerrar uma partida.'
                                    : 'Modo por jogo: ao encerrar cada partida o admin define o valor do jogo e cria a cobrança para os jogadores participantes.'}
                            </p>
                        </div>

                        {/* ── Ações ──────────────────────────────────────── */}
                        <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3">
                            <button
                                className="btn btn-primary"
                                onClick={save}
                                disabled={saving || loading}
                            >
                                {saving ? 'Salvando…' : 'Salvar configurações'}
                            </button>

                            {msg && (
                                <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {msg.text}
                                </span>
                            )}

                            {!isPersisted && !msg && (
                                <span className="text-xs text-amber-600">
                                    ⚠ Configurações ainda não salvas — usando valores padrão.
                                </span>
                            )}
                        </div>

                        {/* ── Info ───────────────────────────────────────── */}
                        <div className="md:col-span-2 card p-4 text-sm text-slate-600 space-y-1">
                            <div className="font-semibold text-slate-800">Como funciona</div>
                            <div>• <b>Local</b> e <b>Horário</b> são pré-preenchidos no formulário "Criar partida".</div>
                            <div>• <b>Mínimo/Máximo de jogadores</b> controla a lista de aceitos na etapa de aceitação.</div>
                            <div>• O <b>Horário</b> é salvo como TimeSpan no banco — formato <code>HH:mm</code> no formulário.</div>
                        </div>

                    </div>
                )}
            </Section>

            {/* ── Ícones da patota ─────────────────────────────── */}
            <Section title="Ícones da patota">
                <p className="text-sm text-slate-500 mb-4">
                    Escolha os ícones exibidos em toda a aplicação para esta patota.
                    Clique em um ícone para selecioná-lo e depois salve as configurações acima.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Gol */}
                    <div className="card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">
                                <IconRenderer value={goalIcon ?? DEFAULT_ICONS.goalIcon} size={20} />
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">Gol</span>
                        </div>
                        <IconPicker
                            options={GOAL_OPTIONS}
                            value={goalIcon}
                            onChange={setGoalIcon}
                        />
                    </div>

                    {/* Goleiro */}
                    <div className="card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">
                                <IconRenderer value={goalkeeperIcon ?? DEFAULT_ICONS.goalkeeperIcon} size={20} />
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">Goleiro</span>
                        </div>
                        <IconPicker
                            options={GOALKEEPER_OPTIONS}
                            value={goalkeeperIcon}
                            onChange={setGoalkeeperIcon}
                        />
                    </div>

                    {/* Assistência */}
                    <div className="card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">
                                <IconRenderer value={assistIcon ?? DEFAULT_ICONS.assistIcon} size={20} />
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">Assistência</span>
                        </div>
                        <IconPicker
                            options={ASSIST_OPTIONS}
                            value={assistIcon}
                            onChange={setAssistIcon}
                        />
                    </div>

                    {/* Gol contra */}
                    <div className="card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">
                                <IconRenderer value={ownGoalIcon ?? DEFAULT_ICONS.ownGoalIcon} size={20} />
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">Gol contra</span>
                        </div>
                        <IconPicker
                            options={OWN_GOAL_OPTIONS}
                            value={ownGoalIcon}
                            onChange={setOwnGoalIcon}
                        />
                    </div>

                    {/* MVP */}
                    <div className="card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">
                                <IconRenderer value={mvpIcon ?? DEFAULT_ICONS.mvpIcon} size={20} />
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">MVP</span>
                        </div>
                        <IconPicker
                            options={MVP_OPTIONS}
                            value={mvpIcon}
                            onChange={setMvpIcon}
                        />
                    </div>

                    {/* Jogador */}
                    <div className="card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">
                                <IconRenderer value={playerIcon ?? DEFAULT_ICONS.playerIcon} size={20} />
                            </span>
                            <span className="font-semibold text-slate-900 text-sm">Jogador</span>
                        </div>
                        <IconPicker
                            options={PLAYER_OPTIONS}
                            value={playerIcon}
                            onChange={setPlayerIcon}
                        />
                    </div>

                </div>
            </Section>

            {/* ── Administradores ──────────────────────────────── */}
            <Section
                title="Administradores"
                right={
                    <button
                        type="button"
                        className="btn btn-secondary flex items-center gap-1.5 text-sm"
                        onClick={() => setAddAdminOpen(true)}
                    >
                        <ShieldPlus size={15} />
                        <span className="hidden sm:inline">Adicionar admin</span>
                    </button>
                }
            >
                {loadingAdmins ? (
                    <div className="muted flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Carregando…
                    </div>
                ) : adminList.length === 0 ? (
                    <div className="muted">Nenhum administrador encontrado.</div>
                ) : (
                    <div className="space-y-2">
                        {adminList.map((admin) => {
                            const isCreator    = createdByUserId && admin.userId === createdByUserId;
                            const isCurrentUser = admin.userId === currentUserId;
                            const isRemoving   = removingId === admin.userId;
                            const displayName  = fullName(admin);
                            const canRemove    = !isCreator;

                            return (
                                <div
                                    key={admin.userId}
                                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                                >
                                    {/* avatar */}
                                    <div className="h-9 w-9 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                        {initials(admin)}
                                    </div>

                                    {/* info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                            {displayName}
                                            {isCurrentUser && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none font-normal">
                                                    Você
                                                </span>
                                            )}
                                        </div>
                                        {admin.userName && (
                                            <div className="text-xs text-slate-400">@{admin.userName}</div>
                                        )}
                                    </div>

                                    {/* badge criador ou botão remover */}
                                    {isCreator ? (
                                        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium shrink-0">
                                            Criador
                                        </span>
                                    ) : canRemove ? (
                                        <button
                                            type="button"
                                            title={`Remover ${displayName} dos admins`}
                                            aria-label={`Remover ${displayName} dos admins`}
                                            disabled={isRemoving}
                                            onClick={() => handleRemoveAdmin(admin.userId, displayName)}
                                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                        >
                                            {isRemoving
                                                ? <><Loader2 size={12} className="animate-spin" /> Removendo…</>
                                                : <><ShieldOff size={13} /> Remover</>
                                            }
                                        </button>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="mt-3 text-xs text-slate-400">
                    O criador do grupo não pode ser removido. Admins podem gerenciar jogadores, partidas e configurações.
                </p>
            </Section>

            {/* ── Modal adicionar admin ─────────────────────────── */}
            <AddAdminModal
                open={addAdminOpen}
                onClose={() => setAddAdminOpen(false)}
                groupId={groupId}
                groupName={group?.name ?? ''}
                existingAdminUserIds={existingAdminUserIds}
                onAdded={loadGroup}
            />

            {/* ── Financeiros ──────────────────────────────────── */}
            <Section
                title="Financeiros"
                right={
                    <button
                        type="button"
                        className="btn btn-secondary flex items-center gap-1.5 text-sm"
                        onClick={() => setAddFinanceiroOpen(true)}
                    >
                        <Wallet size={15} />
                        <span className="hidden sm:inline">Adicionar financeiro</span>
                    </button>
                }
            >
                {loadingAdmins ? (
                    <div className="muted flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Carregando…
                    </div>
                ) : financeiroList.length === 0 ? (
                    <div className="muted">Nenhum financeiro cadastrado.</div>
                ) : (
                    <div className="space-y-2">
                        {financeiroList.map((fin) => {
                            const isCurrentUser  = fin.userId === currentUserId;
                            const isRemoving     = removingFinanceiroId === fin.userId;
                            const displayName    = fullName(fin);
                            return (
                                <div
                                    key={fin.userId}
                                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                                >
                                    <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                        {initials(fin)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                            {displayName}
                                            {isCurrentUser && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none font-normal">
                                                    Você
                                                </span>
                                            )}
                                        </div>
                                        {fin.userName && (
                                            <div className="text-xs text-slate-400">@{fin.userName}</div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        title={`Remover ${displayName} dos financeiros`}
                                        disabled={isRemoving}
                                        onClick={() => handleRemoveFinanceiro(fin.userId, displayName)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        {isRemoving
                                            ? <><Loader2 size={12} className="animate-spin" /> Removendo…</>
                                            : <><ShieldOff size={13} /> Remover</>
                                        }
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="mt-3 text-xs text-slate-400">
                    Financeiros podem gerenciar pagamentos, mensalidades e cobranças extras. Admins não têm acesso automático — devem ser adicionados explicitamente.
                </p>
            </Section>

            {/* ── Modal adicionar financeiro ─────────────────────── */}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="card p-6 w-full max-w-sm space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 text-rose-600">
                            <AlertTriangle size={22} />
                            <span className="font-semibold text-base">Confirmar remoção</span>
                        </div>
                        <p className="text-sm text-slate-700">{confirm.label}</p>
                        <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2 justify-end">
                            <button
                                className="btn py-1.5 px-4 text-sm"
                                onClick={() => setConfirm(null)}
                                disabled={confirmLoading}
                                type="button"
                            >
                                Cancelar
                            </button>
                            <button
                                className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                onClick={runConfirm}
                                disabled={confirmLoading}
                                type="button"
                            >
                                {confirmLoading
                                    ? <><Loader2 size={14} className="animate-spin" /> Removendo…</>
                                    : <><ShieldOff size={14} /> Remover</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
