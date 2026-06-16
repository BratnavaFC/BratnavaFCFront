import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { GroupsApi, TeamBuilderApi } from '../api/endpoints';
import type { TeamBuilderStatsDto, TeamBuilderPlayerDto } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { toast } from 'sonner';

// ─── Posições no campo (x e y em %) ──────────────────────────────────────────

function getOutfieldPositions(n: number): Array<{ x: number; y: number }> {
    const patterns: Record<number, Array<{ x: number; y: number }>> = {
        0: [],
        1: [{ x: 50, y: 40 }],
        2: [{ x: 30, y: 47 }, { x: 70, y: 47 }],
        3: [{ x: 50, y: 32 }, { x: 25, y: 56 }, { x: 75, y: 56 }],
        4: [{ x: 30, y: 33 }, { x: 70, y: 33 }, { x: 22, y: 60 }, { x: 78, y: 60 }],
    };
    return patterns[Math.min(n, 4)] ?? patterns[4];
}

function getPositions(players: TeamBuilderPlayerDto[]): Array<{ x: number; y: number }> {
    const result = new Array<{ x: number; y: number }>(players.length);
    const gkIdx  = players.findIndex(p => p.isGoalkeeper);
    if (gkIdx >= 0) result[gkIdx] = { x: 50, y: 86 };

    const outfieldIdx = players.map((_, i) => i).filter(i => i !== gkIdx);
    const outPos      = getOutfieldPositions(outfieldIdx.length);
    outfieldIdx.forEach((idx, i) => { result[idx] = outPos[i]; });

    return result;
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Football field ───────────────────────────────────────────────────────────

function FootballField({
    players, onRemove, loading,
}: {
    players: TeamBuilderPlayerDto[];
    onRemove: (p: TeamBuilderPlayerDto) => void;
    loading: boolean;
}) {
    const positions = getPositions(players);

    return (
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl select-none"
            style={{ aspectRatio: '2/3', background: 'linear-gradient(180deg, #166534 0%, #15803d 50%, #166534 100%)' }}>

            {/* Grass stripes */}
            <div className="absolute inset-0 opacity-15"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 36px,rgba(0,0,0,.12) 36px,rgba(0,0,0,.12) 72px)' }} />

            {/* SVG field markings */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 300" preserveAspectRatio="none">
                {/* Outer boundary */}
                <rect x="8" y="8" width="184" height="284" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" rx="2" />
                {/* Center line */}
                <line x1="8" y1="150" x2="192" y2="150" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
                {/* Center circle */}
                <circle cx="100" cy="150" r="28" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
                <circle cx="100" cy="150" r="2.5" fill="rgba(255,255,255,.7)" />
                {/* Top penalty area */}
                <rect x="52" y="8" width="96" height="46" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
                {/* Top goal area */}
                <rect x="72" y="8" width="56" height="20" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
                {/* Top goal */}
                <rect x="84" y="2" width="32" height="7" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" rx="1" />
                {/* Bottom penalty area */}
                <rect x="52" y="246" width="96" height="46" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
                {/* Bottom goal area */}
                <rect x="72" y="272" width="56" height="20" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
                {/* Bottom goal */}
                <rect x="84" y="291" width="32" height="7" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" rx="1" />
                {/* Penalty spots */}
                <circle cx="100" cy="36"  r="2" fill="rgba(255,255,255,.55)" />
                <circle cx="100" cy="264" r="2" fill="rgba(255,255,255,.55)" />
                {/* Corner arcs */}
                {[
                    { cx:  8, cy:   8, start: 0,   end: 90  },
                    { cx: 192, cy:  8, start: 90,  end: 180 },
                    { cx:  8, cy: 292, start: 270, end: 360 },
                    { cx: 192, cy: 292, start: 180, end: 270 },
                ].map((c, i) => (
                    <path key={i}
                        d={`M ${c.cx + 8 * Math.cos(c.start * Math.PI / 180)} ${c.cy + 8 * Math.sin(c.start * Math.PI / 180)} A 8 8 0 0 1 ${c.cx + 8 * Math.cos(c.end * Math.PI / 180)} ${c.cy + 8 * Math.sin(c.end * Math.PI / 180)}`}
                        fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1" />
                ))}
            </svg>

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20 rounded-2xl">
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-4xl animate-bounce">⚽</div>
                        <span className="text-white text-sm font-medium">Buscando…</span>
                    </div>
                </div>
            )}

            {/* Empty hint */}
            {players.length === 0 && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                    <div className="text-5xl opacity-40">⚽</div>
                    <p className="text-white/50 text-sm text-center leading-relaxed">
                        Selecione jogadores abaixo<br />para montar o time
                    </p>
                </div>
            )}

            {/* Players */}
            {players.map((p, i) => {
                const pos = positions[i];
                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onRemove(p)}
                        title={`Remover ${p.name}`}
                        className="absolute z-10 group"
                        style={{
                            left: `${pos.x}%`,
                            top:  `${pos.y}%`,
                            transform: 'translate(-50%, -50%)',
                            animation: 'popIn .35s cubic-bezier(.34,1.56,.64,1) both',
                        }}
                    >
                        {/* Bubble */}
                        <div className={`relative w-11 h-11 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-sm font-black transition-transform group-hover:scale-110
                            ${p.isGoalkeeper ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-600 text-white'}`}>
                            {p.isGoalkeeper ? '🧤' : <span className="text-xs">{initials(p.name)}</span>}
                            {/* Remove X on hover */}
                            <span className="absolute inset-0 rounded-full bg-red-600/90 hidden group-hover:flex items-center justify-center text-white">
                                <X size={14} />
                            </span>
                        </div>
                        {/* Name tag */}
                        <div className="mt-1 px-1.5 py-0.5 bg-black/55 rounded text-white text-[9px] font-semibold text-center max-w-[56px] truncate leading-tight">
                            {p.name.split(' ')[0]}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: TeamBuilderStatsDto }) {
    if (stats.neverPlayedTogether) {
        return (
            <div className="rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-700 p-6 text-center space-y-2 animate-[fadeUp_.3s_ease_both]">
                <div className="text-4xl">🤷</div>
                <p className="text-white font-semibold">Nunca jogaram juntos</p>
                <p className="text-slate-400 text-xs">Nenhuma partida finalizada com todos presentes.</p>
            </div>
        );
    }

    const total = stats.wins + stats.draws + stats.losses;
    const winPct = total > 0 ? Math.round(stats.wins / total * 100) : 0;

    return (
        <div className="space-y-3 animate-[fadeUp_.3s_ease_both]">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <span className="text-lg">📊</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">
                    {stats.totalMatches} partida{stats.totalMatches !== 1 ? 's' : ''} juntos
                </span>
                <span className="ml-auto text-xs text-slate-400">{winPct}% de vitória</span>
            </div>

            {/* W / D / L */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Vitórias', value: stats.wins,   emoji: '🏆', bg: 'bg-green-500', text: 'text-green-50' },
                    { label: 'Empates',  value: stats.draws,  emoji: '🤝', bg: 'bg-amber-500', text: 'text-amber-50' },
                    { label: 'Derrotas', value: stats.losses, emoji: '💔', bg: 'bg-red-500',   text: 'text-red-50'   },
                ].map(({ label, value, emoji, bg, text }) => (
                    <div key={label} className={`${bg} rounded-xl py-3 text-center shadow`}>
                        <div className="text-xl">{emoji}</div>
                        <div className={`text-2xl font-black ${text}`}>{value}</div>
                        <div className={`text-[10px] font-semibold ${text} opacity-80`}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Goals scoreboard */}
            <div className="rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700 px-4 py-3 flex items-center justify-center gap-4">
                <div className="text-center">
                    <div className="text-2xl">⚽</div>
                    <div className="text-2xl font-black text-white">{stats.goalsScored}</div>
                    <div className="text-[10px] text-slate-400">marcados</div>
                </div>
                <div className="text-slate-600 text-2xl font-thin">|</div>
                <div className="text-center">
                    <div className="text-2xl">🥅</div>
                    <div className="text-2xl font-black text-white">{stats.goalsConceded}</div>
                    <div className="text-[10px] text-slate-400">sofridos</div>
                </div>
            </div>

            {/* Assists */}
            {stats.assistPairs.length > 0 && (
                <div className="rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700 p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        🎯 <span>Assistências entre eles</span>
                    </div>
                    {stats.assistPairs.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-slate-100 font-semibold">{a.assisterName.split(' ')[0]}</span>
                            <span className="text-slate-500 text-xs">→</span>
                            <span className="text-slate-100 font-semibold">{a.scorerName.split(' ')[0]}</span>
                            <span className="ml-auto bg-slate-700 text-slate-200 text-xs font-bold px-2 py-0.5 rounded-full">{a.count}x</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Player selector ──────────────────────────────────────────────────────────

function PlayerSelector({
    all, selected, onToggle,
}: {
    all: TeamBuilderPlayerDto[];
    selected: TeamBuilderPlayerDto[];
    onToggle: (p: TeamBuilderPlayerDto) => void;
}) {
    const isSelected = (p: TeamBuilderPlayerDto) => selected.some(s => s.id === p.id);
    const gkCount    = selected.filter(p => p.isGoalkeeper).length;

    const canAdd = (p: TeamBuilderPlayerDto) => {
        if (isSelected(p)) return false;
        if (selected.length >= 5) return false;
        if (p.isGoalkeeper && gkCount >= 1) return false;
        return true;
    };

    return (
        <div className="space-y-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
                {selected.length < 2
                    ? `Selecione mais ${2 - selected.length} jogador${2 - selected.length !== 1 ? 'es' : ''} para ver as estatísticas`
                    : selected.length < 5
                        ? `${5 - selected.length} vaga${5 - selected.length !== 1 ? 's' : ''} restante${5 - selected.length !== 1 ? 's' : ''}`
                        : 'Time completo!'}
            </p>
            <div className="flex flex-wrap gap-2">
                {all.map(p => {
                    const sel  = isSelected(p);
                    const able = canAdd(p);

                    return (
                        <button
                            key={p.id}
                            type="button"
                            disabled={!sel && !able}
                            onClick={() => onToggle(p)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200
                                ${sel
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white scale-105'
                                    : able
                                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-slate-900 dark:hover:border-white hover:scale-105'
                                        : 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                }`}
                        >
                            {p.isGoalkeeper && <span>🧤</span>}
                            <span>{p.name.split(' ')[0]}</span>
                            {sel && <X size={10} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamBuilderPage() {
    const active   = useAccountStore(s => s.getActive());
    const groupId  = active?.activeGroupId;
    const isAdmin  = active?.activeGroupIsAdmin
                  || active?.roles?.includes('Admin')
                  || active?.roles?.includes('GodMode');

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 text-sm">
                Acesso restrito a administradores do grupo.
            </div>
        );
    }

    const [allPlayers, setAllPlayers] = useState<TeamBuilderPlayerDto[]>([]);
    const [selected,   setSelected]   = useState<TeamBuilderPlayerDto[]>([]);
    const [stats,      setStats]      = useState<TeamBuilderStatsDto | null>(null);
    const [loading,    setLoading]    = useState(false);
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!groupId) return;
        GroupsApi.get(groupId).then(res => {
            const data = (res.data as any)?.data ?? res.data;
            const raw  = (data?.players ?? []) as any[];
            setAllPlayers(
                raw
                    .filter((p: any) => !p.isGuest && p.status !== 'Inactive' && p.status !== 2)
                    .map((p: any) => ({ id: p.id as string, name: p.name as string, isGoalkeeper: (p.isGoalkeeper ?? false) as boolean }))
                    .sort((a: TeamBuilderPlayerDto, b: TeamBuilderPlayerDto) => a.name.localeCompare(b.name))
            );
        }).catch(() => toast.error('Erro ao carregar jogadores.'));
    }, [groupId]);

    useEffect(() => {
        if (debounce.current) clearTimeout(debounce.current);
        if (selected.length < 2) { setStats(null); return; }

        debounce.current = setTimeout(async () => {
            if (!groupId) return;
            setLoading(true);
            setStats(null);
            try {
                const res = await TeamBuilderApi.stats(groupId, selected.map(p => p.id));
                setStats((res.data as any)?.data ?? res.data);
            } catch {
                toast.error('Erro ao buscar estatísticas.');
            } finally {
                setLoading(false);
            }
        }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    const toggle = (p: TeamBuilderPlayerDto) => {
        setStats(null);
        setSelected(prev =>
            prev.some(s => s.id === p.id)
                ? prev.filter(s => s.id !== p.id)
                : [...prev, p]
        );
    };

    const hint = selected.length < 2
        ? `Selecione mais ${2 - selected.length} jogador${2 - selected.length !== 1 ? 'es' : ''}`
        : selected.length < 5
            ? `${5 - selected.length} vaga${5 - selected.length !== 1 ? 's' : ''} restante${5 - selected.length !== 1 ? 's' : ''}`
            : 'Time completo!';

    return (
        <>
            <style>{`
                @keyframes popIn  { from { transform: translate(-50%,-50%) scale(0); opacity:0 } to { transform: translate(-50%,-50%) scale(1); opacity:1 } }
                @keyframes fadeUp { from { transform: translateY(10px); opacity:0 } to { transform: translateY(0); opacity:1 } }
            `}</style>

            {/* ── mobile: coluna / desktop: 3 colunas ── */}
            <div className="min-h-screen pb-12">

                {/* Header */}
                <div className="text-center py-6">
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">⚽ Monte seu Time</h1>
                    <p className="text-xs text-amber-500 font-semibold mt-1">🎉 Funcionalidade de evento</p>
                </div>

                {/* ── Mobile layout ── */}
                <div className="flex flex-col gap-5 px-4 lg:hidden">
                    {/* Players */}
                    <PlayerSelector all={allPlayers} selected={selected} onToggle={toggle} />

                    {/* Field */}
                    <div className="max-w-xs mx-auto w-full">
                        <FootballField players={selected} onRemove={toggle} loading={loading} />
                        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">{hint}</p>
                    </div>

                    {/* Stats */}
                    {stats && <StatsPanel stats={stats} />}
                </div>

                {/* ── Desktop layout ── */}
                <div className="hidden lg:grid lg:grid-cols-[1fr_280px_1fr] lg:gap-6 lg:px-8 lg:max-w-5xl lg:mx-auto">

                    {/* Left — player selector */}
                    <div className="flex flex-col gap-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Jogadores</p>
                        <PlayerSelector all={allPlayers} selected={selected} onToggle={toggle} />
                    </div>

                    {/* Center — field */}
                    <div className="flex flex-col items-center gap-2">
                        <FootballField players={selected} onRemove={toggle} loading={loading} />
                        <p className="text-center text-xs text-slate-400 dark:text-slate-500">{hint}</p>
                    </div>

                    {/* Right — stats */}
                    <div className="flex flex-col gap-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estatísticas</p>
                        {stats
                            ? <StatsPanel stats={stats} />
                            : (
                                <div className="flex flex-col items-center justify-center gap-3 h-48 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600">
                                    <span className="text-3xl opacity-50">📊</span>
                                    <p className="text-xs text-center leading-relaxed">
                                        Selecione 2 ou mais<br />jogadores para ver os dados
                                    </p>
                                </div>
                            )
                        }
                    </div>
                </div>
            </div>
        </>
    );
}
