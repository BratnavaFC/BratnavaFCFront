import { useEffect, useMemo, useState } from 'react';
import { Cake, RefreshCw, UserX } from 'lucide-react';
import { http } from '../api/http';
import { useAccountStore } from '../auth/accountStore';

// ── Types ─────────────────────────────────────────────────────────────────────

type PlayerStatus = {
    playerId: string;
    name: string;
    hasBirthday: boolean;
    birthDate: string | null;   // "dd/MM/yyyy"
    birthMonth: number | null;
    birthDay: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function daysUntilBirthday(month: number, day: number): number {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisYear = new Date(today.getFullYear(), month - 1, day);
    const diff = Math.floor((thisYear.getTime() - today.getTime()) / 86_400_000);
    return diff >= 0 ? diff : diff + 365;
}

function CountdownBadge({ days }: { days: number }) {
    if (days === 0)
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                🎂 Hoje!
            </span>
        );
    if (days <= 7)
        return (
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                em {days}d
            </span>
        );
    if (days <= 30)
        return (
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                em {days}d
            </span>
        );
    return (
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {days}d
        </span>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

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

    // Month keys in the order returned from backend (sorted by proximity)
    const monthOrder = useMemo(() => {
        const seen = new Set<number>();
        const order: number[] = [];
        for (const p of withBirthday) {
            if (!seen.has(p.birthMonth!)) {
                seen.add(p.birthMonth!);
                order.push(p.birthMonth!);
            }
        }
        return order;
    }, [withBirthday]);

    const byMonth = useMemo(() => {
        const map = new Map<number, PlayerStatus[]>();
        for (const p of withBirthday) {
            const m = p.birthMonth!;
            if (!map.has(m)) map.set(m, []);
            map.get(m)!.push(p);
        }
        return map;
    }, [withBirthday]);

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                            <Cake size={26} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black leading-tight">Aniversários</h1>
                            <p className="text-sm text-white/50 mt-0.5">
                                {loading
                                    ? 'Carregando...'
                                    : `${withBirthday.length} de ${players.length} com data cadastrada`}
                            </p>
                        </div>
                    </div>
                    {groupId && (
                        <button
                            type="button"
                            onClick={load}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Skeleton ── */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── Empty ── */}
            {!loading && players.length === 0 && (
                <div className="card p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 shadow-sm">
                    <Cake size={36} className="opacity-30" />
                    <p className="text-sm font-medium">Nenhum jogador encontrado.</p>
                </div>
            )}

            {/* ── Month groups ── */}
            {!loading && monthOrder.map(month => {
                const group = byMonth.get(month)!;
                return (
                    <div key={month} className="card p-0 overflow-hidden shadow-sm">
                        {/* Card header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center gap-2.5">
                            <div className="h-6 w-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Cake size={13} className="text-amber-500" />
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
                                {MONTH_NAMES[month - 1]}
                            </span>
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                {group.length} jogador{group.length !== 1 ? 'es' : ''}
                            </span>
                        </div>

                        {/* Player rows */}
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.map(p => {
                                const days = daysUntilBirthday(p.birthMonth!, p.birthDay!);
                                return (
                                    <li key={p.playerId} className="flex items-center gap-3 px-5 py-3">
                                        {/* Day chip */}
                                        <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center shrink-0">
                                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums leading-none">
                                                {p.birthDay}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1 truncate">
                                            {p.name}
                                        </span>
                                        <CountdownBadge days={days} />
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}

            {/* ── Without birthday ── */}
            {!loading && withoutBirthday.length > 0 && (
                <div className="card p-0 overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-lg bg-slate-400/10 flex items-center justify-center">
                            <UserX size={13} className="text-slate-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
                            Sem data cadastrada
                        </span>
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            {withoutBirthday.length} jogador{withoutBirthday.length !== 1 ? 'es' : ''}
                        </span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {withoutBirthday.map(p => (
                            <li key={p.playerId} className="flex items-center gap-3 px-5 py-3">
                                <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                <span className="text-sm text-slate-500 dark:text-slate-400">{p.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

        </div>
    );
}
