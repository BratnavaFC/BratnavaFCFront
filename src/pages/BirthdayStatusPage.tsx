import { useEffect, useState } from 'react';
import { Cake, RefreshCw } from 'lucide-react';
import { http } from '../api/http';
import { useAccountStore } from '../auth/accountStore';

type PlayerStatus = {
    playerId: string;
    name: string;
    hasBirthday: boolean;
    birthDate: string | null;
};

export default function BirthdayStatusPage() {
    const groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const [players, setPlayers] = useState<PlayerStatus[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await http.get(`/api/Players/group/${groupId}/birthday-status`);
            setPlayers((res.data as any)?.data ?? []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

    const withBirthday    = players.filter(p => p.hasBirthday);
    const withoutBirthday = players.filter(p => !p.hasBirthday);

    return (
        <div className="space-y-5 max-w-xl">

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-pink-500/10 flex items-center justify-center">
                        <Cake size={20} className="text-pink-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Aniversários</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {withBirthday.length} de {players.length} preenchidos
                        </p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="btn"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {loading && (
                <div className="space-y-2">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && players.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-10">
                    Nenhum jogador encontrado.
                </p>
            )}

            {!loading && withoutBirthday.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-800/40">
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                            Sem data · {withoutBirthday.length}
                        </span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {withoutBirthday.map(p => (
                            <li key={p.playerId} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{p.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!loading && withBirthday.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-800/40">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                            Com data · {withBirthday.length}
                        </span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {withBirthday.map(p => (
                            <li key={p.playerId} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{p.name}</span>
                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                                    {p.birthDate}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

        </div>
    );
}
