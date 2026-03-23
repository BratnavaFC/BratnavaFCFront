// src/components/modals/AddFinanceiroModal.tsx
import { useEffect, useState } from 'react';
import { Check, Loader2, Search, Wallet, X } from 'lucide-react';
import { GroupsApi, UsersApi } from '../../api/endpoints';
import { getResponseMessage } from '../../api/apiResponse';

type UserResult = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
};

function fullName(u: UserResult) {
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.userName || 'Admin';
}

function initials(u: UserResult) {
    const f = u.firstName?.[0] ?? '';
    const l = u.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || (u.userName?.[0] ?? '?').toUpperCase();
}

export function AddFinanceiroModal({
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

    // ESC key handler
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

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
                setResults((res.data?.data as any)?.items ?? []);
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
            const msg = getResponseMessage(e, 'Erro ao adicionar financeiro.');
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
                <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                                <Wallet size={17} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900 dark:text-white">Adicionar financeiro</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{groupName}</div>
                            </div>
                        </div>
                        <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Fechar" type="button">
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
                                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3">
                                            <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                {initials(u)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{fullName(u)}</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500">@{u.userName}</div>
                                            </div>
                                            {isAlready ? (
                                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 shrink-0">Já é financeiro</span>
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

export default AddFinanceiroModal;
