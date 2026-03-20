// src/pages/PlayerSpotlightPage.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { TeamGenApi } from '../api/endpoints';
import useAccountStore from '../auth/accountStore';
import {
    ChevronLeft, ChevronRight, Play, Pause, Maximize2, Minimize2,
    Trophy, TrendingDown, Swords, Shield, Handshake, Star,
    Loader2, Users, Goal, Medal, Footprints, BarChart3,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type SpotlightRelation = {
    playerId: string;
    name: string;
    count: number;
    rate: number;
};

type PlayerSpotlightItem = {
    playerId: string;
    name: string;
    isGoalkeeper: boolean;
    isGuest: boolean;
    gamesPlayed: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    goals: number;
    assists: number;
    mvps: number;
    bestPartners: SpotlightRelation[];
    worstPartners: SpotlightRelation[];
    mostBeatenBy: SpotlightRelation[];
    leastBeatenBy: SpotlightRelation[];
    mostAssistedBy: SpotlightRelation[];
    mostAssistedTo: SpotlightRelation[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function pct(rate: number) {
    return `${Math.round(rate * 100)}%`;
}

function cls(...args: (string | boolean | undefined | null)[]) {
    return args.filter(Boolean).join(' ');
}

function topN<T>(arr: T[], key: keyof T, n = 5): T[] {
    return [...arr]
        .filter(p => (p[key] as unknown as number) > 0)
        .sort((a, b) => (b[key] as unknown as number) - (a[key] as unknown as number))
        .slice(0, n);
}

// Ranking denso: empates compartilham a mesma posição e o próximo é sequencial.
// Inclui todos os empatados mesmo que ultrapassem n itens.
function topNRanked(
    items: { name: string; value: number | string }[],
    n = 5,
): { name: string; value: number | string; rank: number }[] {
    const sorted = [...items].filter(it => Number(it.value) > 0)
        .sort((a, b) => Number(b.value) - Number(a.value));

    const result: { name: string; value: number | string; rank: number }[] = [];
    let rank = 0;
    for (let i = 0; i < sorted.length; i++) {
        if (i === 0 || sorted[i].value !== sorted[i - 1].value) rank++;
        if (rank > n) break;
        result.push({ ...sorted[i], rank });
    }
    return result;
}

function formatDate(d: Date): string {
    return d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

// ── CoverSlide ─────────────────────────────────────────────────────────────────
// NOTE: Place the Bratnava logo image at: public/bratnava-logo.png
function CoverSlide({ isFullscreen }: { isFullscreen: boolean }) {
    const today = formatDate(new Date(2026, 3, 17)); // 17/04/2026 – Sexta-feira

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none">

            {/* ── Radial amber glow in the centre ── */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(217,119,6,0.22) 0%, transparent 70%)' }}
            />

            {/* ── Subtle dot grid ── */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
            />

            {/* ── Foreground logo (crisp, smaller) ── */}
            <div className={cls(
                'relative z-10',
                isFullscreen ? 'w-56 h-56 mb-8' : 'w-36 h-36 mb-5',
            )}>
                <img
                    src={`${import.meta.env.BASE_URL}bratnava-logo.png`}
                    alt="Bratnava FC"
                    className="w-full h-full object-contain"
                    style={{ filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.55))' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
            </div>

            {/* ── Badge "2ª edição" ── */}
            <div className="relative z-10 mb-4 px-4 py-1 rounded-full border border-amber-400/40 bg-amber-400/10">
                <span className={cls('font-bold tracking-[0.2em] uppercase text-amber-300', isFullscreen ? 'text-xl' : 'text-xs')}>
                    2ª Edição
                </span>
            </div>

            {/* ── Main title ── */}
            <h1
                className="relative z-10 font-black text-center uppercase leading-[0.9] tracking-tight text-white"
                style={{
                    fontSize: isFullscreen ? 'clamp(4rem, 9vw, 8rem)' : 'clamp(2rem, 6vw, 3.5rem)',
                    textShadow: '0 4px 40px rgba(0,0,0,0.7)',
                }}
            >
                <span style={{ WebkitTextStroke: isFullscreen ? '2px #fbbf24' : '1px #fbbf24', color: 'transparent' }}>
                    Hamburgada
                </span>
                <br />
                <span className="text-amber-400" style={{ textShadow: '0 0 40px rgba(251,191,36,0.5)' }}>
                    do Bratnava!
                </span>
            </h1>

            {/* ── Divider ── */}
            <div className="relative z-10 my-5 flex items-center gap-3 w-64">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-400/50" />
                <span className={cls('text-amber-400/70', isFullscreen ? 'text-2xl' : 'text-lg')}>🍔</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-400/50" />
            </div>

            {/* ── Date ── */}
            <p className={cls(
                'relative z-10 text-white/70 font-semibold capitalize tracking-widest',
                isFullscreen ? 'text-2xl' : 'text-sm',
            )}>
                {today}
            </p>
        </div>
    );
}

// ── StatsTopList ───────────────────────────────────────────────────────────────
function StatsTopList({
    icon: Icon,
    label,
    items,
    valueLabel,
    accentClass,
}: {
    icon: any;
    label: string;
    items: { name: string; value: string | number; rank: number }[];
    valueLabel: string;
    accentClass: string;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className={cls('flex items-center gap-2 text-base font-bold uppercase tracking-widest', accentClass)}>
                <Icon size={17} />
                <span>{label}</span>
            </div>
            {items.length === 0 ? (
                <p className="text-lg text-white/30 italic">Sem dados</p>
            ) : (
                <ol className="space-y-2.5">
                    {Object.values(
                        items.reduce<Record<number, typeof items>>((acc, item) => {
                            (acc[item.rank] ??= []).push(item);
                            return acc;
                        }, {})
                    ).map(group => {
                        const { rank, value } = group[0];
                        const names = group.map(g => g.name).join(' | ');
                        return (
                            <li key={rank} className="flex items-center gap-2">
                                <span className={cls(
                                    'text-base font-black w-7 shrink-0 text-center rounded',
                                    rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-700' : 'text-white/25',
                                )}>
                                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
                                </span>
                                <span className="text-white font-semibold text-lg flex-1 truncate">{names}</span>
                                <span className={cls('text-base font-bold shrink-0', accentClass.replace('-400', '-300').replace('-500', '-300'))}>
                                    {value} <span className="text-white/30 font-normal">{valueLabel}</span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

// ── StatsSlide ─────────────────────────────────────────────────────────────────
function StatsSlide({ players, isFullscreen }: { players: PlayerSpotlightItem[]; isFullscreen: boolean }) {
    const mensalistas = players.filter(p => !p.isGuest);

    const top5Presencas = topNRanked(mensalistas.map(p => ({ name: p.name, value: p.gamesPlayed })));
    const top5Gols      = topNRanked(mensalistas.map(p => ({ name: p.name, value: p.goals })));
    const top5Assists   = topNRanked(mensalistas.map(p => ({ name: p.name, value: p.assists })));
    const top5Vitorias  = topNRanked(mensalistas.map(p => ({ name: p.name, value: p.wins })));
    const top5Mvps      = topNRanked(mensalistas.map(p => ({ name: p.name, value: p.mvps })));

    // Win Rate: apenas mensalistas com >= 5 jogos
    const top5WinRate = topNRanked(
        mensalistas
            .filter(p => p.gamesPlayed >= 5)
            .map(p => ({ name: p.name, value: Math.round(p.winRate * 100) }))
    ).map(p => ({ ...p, value: `${p.value}%` }));

    const stats = [
        { icon: Footprints,  label: 'Top 5 Presenças',          items: top5Presencas, valueLabel: 'jogos',    accentClass: 'text-sky-400' },
        { icon: Goal,        label: 'Top 5 Gols',                items: top5Gols,      valueLabel: 'gols',    accentClass: 'text-emerald-400' },
        { icon: Handshake,   label: 'Top 5 Assistências',        items: top5Assists,   valueLabel: 'assist.', accentClass: 'text-purple-400' },
        { icon: BarChart3,   label: 'Top 5 Win Rate (mín. 5j)',  items: top5WinRate,   valueLabel: '',        accentClass: 'text-amber-400' },
        { icon: Trophy,      label: 'Top 5 Vitórias',            items: top5Vitorias,  valueLabel: 'vitórias',accentClass: 'text-yellow-400' },
        { icon: Medal,       label: 'Top 5 MVPs',                items: top5Mvps,      valueLabel: 'MVPs',    accentClass: 'text-rose-400' },
    ];

    return (
        <div className={cls(
            'w-full h-full flex flex-col',
            isFullscreen ? 'p-10 md:p-14' : 'p-6 md:p-8',
        )}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Trophy size={isFullscreen ? 36 : 28} className="text-amber-400 shrink-0" />
                <h2 className={cls('font-black text-white leading-none', isFullscreen ? 'text-5xl' : 'text-3xl')}>
                    Estatísticas da Patota
                </h2>
            </div>

            {/* 3 × 2 grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7 flex-1">
                {stats.map(s => (
                    <StatsTopList
                        key={s.label}
                        icon={s.icon}
                        label={s.label}
                        items={s.items}
                        valueLabel={s.valueLabel}
                        accentClass={s.accentClass}
                    />
                ))}
            </div>
        </div>
    );
}

// ── RelationList: renders a section of Top-3 relations ────────────────────────
function RelationList({
    icon: Icon,
    label,
    items,
    renderExtra,
    emptyMsg,
    accentClass,
}: {
    icon: any;
    label: string;
    items: SpotlightRelation[];
    renderExtra: (r: SpotlightRelation) => React.ReactNode;
    emptyMsg: string;
    accentClass: string;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className={cls('flex items-center gap-2 text-base font-bold uppercase tracking-widest', accentClass)}>
                <Icon size={17} />
                <span>{label}</span>
            </div>
            {items.length === 0 ? (
                <p className="text-lg text-white/30 italic">{emptyMsg}</p>
            ) : (
                <ol className="space-y-2.5">
                    {items.map((r, i) => (
                        <li key={r.playerId} className="flex items-center gap-2">
                            <span className="text-white/30 text-base w-6 shrink-0">{i + 1}.</span>
                            <span className="text-white font-semibold text-lg flex-1 truncate">{r.name}</span>
                            {renderExtra(r)}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

// ── PlayerSlide: one full card for a player ────────────────────────────────────
function PlayerSlide({ player, isFullscreen }: { player: PlayerSpotlightItem; isFullscreen: boolean }) {
    const emoji = player.isGoalkeeper ? '🧤' : '⚽';

    return (
        <div className={cls(
            'w-full h-full flex flex-col',
            isFullscreen ? 'p-10 md:p-16' : 'p-6 md:p-10',
        )}>
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={cls(
                        'rounded-2xl bg-white/10 flex items-center justify-center shrink-0 text-3xl font-black text-white select-none',
                        isFullscreen ? 'w-20 h-20 text-4xl' : 'w-14 h-14 text-2xl',
                    )}>
                        {emoji}
                    </div>
                    <div>
                        <h2 className={cls('font-black text-white leading-none', isFullscreen ? 'text-7xl' : 'text-5xl')}>
                            {player.name}
                        </h2>
                        <p className="text-white/50 text-lg mt-1">{player.isGoalkeeper ? 'Goleiro' : 'Linha'}</p>
                    </div>
                </div>
                {/* Quick stats pills */}
                <div className="flex flex-wrap gap-2 justify-end">
                    {[
                        { label: 'Partidas', value: player.gamesPlayed },
                        { label: 'Vitórias', value: player.wins },
                        { label: 'Win %', value: pct(player.winRate) },
                        { label: 'Gols', value: player.goals },
                        { label: 'Assist.', value: player.assists },
                        ...(player.mvps > 0 ? [{ label: 'MVPs', value: player.mvps }] : []),
                    ].map(s => (
                        <div key={s.label} className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                            <div className="text-white font-bold text-xl leading-none">{s.value}</div>
                            <div className="text-white/40 text-sm mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 6 relation blocks in a 3×2 grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
                <RelationList
                    icon={Handshake}
                    label="Melhores parceiros"
                    items={player.bestPartners}
                    accentClass="text-emerald-400"
                    emptyMsg="Sem dados suficientes"
                    renderExtra={r => (
                        <span className="text-emerald-300 text-base font-bold shrink-0">
                            {pct(r.rate)} <span className="text-white/30 font-normal">({r.count}j)</span>
                        </span>
                    )}
                />
                <RelationList
                    icon={TrendingDown}
                    label="Piores parceiros"
                    items={player.worstPartners}
                    accentClass="text-orange-400"
                    emptyMsg="Sem dados suficientes"
                    renderExtra={r => (
                        <span className="text-orange-300 text-base font-bold shrink-0">
                            {pct(r.rate)} <span className="text-white/30 font-normal">({r.count}j)</span>
                        </span>
                    )}
                />
                <RelationList
                    icon={Swords}
                    label="Mais me vencem"
                    items={player.mostBeatenBy}
                    accentClass="text-red-400"
                    emptyMsg="Sem dados suficientes"
                    renderExtra={r => (
                        <span className="text-red-300 text-base font-bold shrink-0">
                            {pct(r.rate)} <span className="text-white/30 font-normal">({r.count}j)</span>
                        </span>
                    )}
                />
                <RelationList
                    icon={Shield}
                    label="Mais venci"
                    items={player.leastBeatenBy}
                    accentClass="text-sky-400"
                    emptyMsg="Sem dados suficientes"
                    renderExtra={r => (
                        <span className="text-sky-300 text-base font-bold shrink-0">
                            {pct(r.rate)} <span className="text-white/30 font-normal">({r.count}j)</span>
                        </span>
                    )}
                />
                <RelationList
                    icon={Star}
                    label="Mais me assistiram"
                    items={player.mostAssistedBy}
                    accentClass="text-yellow-400"
                    emptyMsg="Sem gols assistidos"
                    renderExtra={r => (
                        <span className="text-yellow-300 text-base font-bold shrink-0">
                            {r.count}× <span className="text-white/30 font-normal">assist.</span>
                        </span>
                    )}
                />
                <RelationList
                    icon={Trophy}
                    label="Mais assisti"
                    items={player.mostAssistedTo}
                    accentClass="text-purple-400"
                    emptyMsg="Sem assistências dadas"
                    renderExtra={r => (
                        <span className="text-purple-300 text-base font-bold shrink-0">
                            {r.count}× <span className="text-white/30 font-normal">assist.</span>
                        </span>
                    )}
                />
            </div>
        </div>
    );
}

// ── Slide type helpers ─────────────────────────────────────────────────────────
const SLIDE_COVER = 0;
const SLIDE_STATS = 1;
const PLAYER_OFFSET = 2; // slides 2..N+1 are player slides

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PlayerSpotlightPage() {
    const active    = useAccountStore(s => s.getActive());
    const groupId   = active?.activeGroupId ?? '';

    const [players, setPlayers]       = useState<PlayerSpotlightItem[]>([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState<string | null>(null);
    const [current, setCurrent]       = useState(0);
    const [playing, setPlaying]       = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

    const totalSlides = players.length + PLAYER_OFFSET;

    // ── Load data ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!groupId) return;
        setLoading(true);
        TeamGenApi.spotlight(groupId)
            .then(res => {
                const data = (res.data as any)?.players ?? [];
                setPlayers(data);
                setCurrent(0);
            })
            .catch(() => setError('Erro ao carregar dados do spotlight.'))
            .finally(() => setLoading(false));
    }, [groupId]);

    // ── Auto-advance ───────────────────────────────────────────────────────────
    const goNext = useCallback(() => {
        setCurrent(c => (c + 1) % (totalSlides || 1));
    }, [totalSlides]);

    const goPrev = useCallback(() => {
        setCurrent(c => (c - 1 + (totalSlides || 1)) % (totalSlides || 1));
    }, [totalSlides]);

    useEffect(() => {
        if (playing && totalSlides > 1) {
            intervalRef.current = setInterval(goNext, 8000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [playing, totalSlides, goNext]);

    // ── Fullscreen API ─────────────────────────────────────────────────────────
    const enterFullscreen = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        if (el.requestFullscreen) el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        setIsFullscreen(true);
        setPlaying(true);
    }, []);

    const exitFullscreen = useCallback(() => {
        if (document.exitFullscreen) document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        setIsFullscreen(false);
    }, []);

    useEffect(() => {
        function handleFSChange() {
            const el = document.fullscreenElement ?? (document as any).webkitFullscreenElement;
            if (!el) {
                setIsFullscreen(false);
                setPlaying(false);
            }
        }
        document.addEventListener('fullscreenchange', handleFSChange);
        document.addEventListener('webkitfullscreenchange', handleFSChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFSChange);
            document.removeEventListener('webkitfullscreenchange', handleFSChange);
        };
    }, []);

    // ── Keyboard navigation ────────────────────────────────────────────────────
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft')  goPrev();
            if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
            if (e.key === 'Escape' && isFullscreen) exitFullscreen();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [goNext, goPrev, isFullscreen, exitFullscreen]);

    // ── Render ─────────────────────────────────────────────────────────────────
    if (!groupId) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                Selecione uma patota pelo seletor no topo.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 gap-2 text-slate-500">
                <Loader2 size={18} className="animate-spin" /> Carregando spotlight...
            </div>
        );
    }

    if (error) {
        return <div className="text-rose-500 p-6">{error}</div>;
    }

    if (players.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                <Users size={36} className="opacity-40" />
                <p>Nenhum dado disponível. Finalize algumas partidas primeiro.</p>
            </div>
        );
    }

    // Background gradient shifts per slide
    const gradients = [
        // slide 0 – cover: amber/orange festive
        'from-slate-900 via-amber-950 to-orange-950',
        // slide 1 – stats: teal/blue
        'from-slate-900 via-teal-950 to-slate-900',
        // slide 2+ – players: cycling
        'from-slate-900 via-indigo-950 to-slate-900',
        'from-slate-900 via-emerald-950 to-slate-900',
        'from-slate-900 via-purple-950 to-slate-900',
        'from-slate-900 via-rose-950  to-slate-900',
        'from-slate-900 via-sky-950   to-slate-900',
        'from-slate-900 via-amber-950 to-slate-900',
    ];

    function getGradient(idx: number) {
        if (idx === SLIDE_COVER) return gradients[0];
        if (idx === SLIDE_STATS) return gradients[1];
        return gradients[PLAYER_OFFSET + ((idx - PLAYER_OFFSET) % (gradients.length - PLAYER_OFFSET))];
    }

    function getSlideLabel(idx: number): string {
        if (idx === SLIDE_COVER) return 'Hamburgada 🍔';
        if (idx === SLIDE_STATS) return 'Estatísticas 🏆';
        return players[idx - PLAYER_OFFSET]?.name ?? '';
    }

    const gradient = getGradient(current);

    return (
        <div
            ref={containerRef}
            className={cls(
                'relative flex flex-col bg-gradient-to-br transition-all duration-700',
                gradient,
                isFullscreen
                    ? 'fixed inset-0 z-50'
                    : 'rounded-2xl overflow-hidden min-h-[560px]',
            )}
        >
            {/* ── Slide area ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden relative">
                {/* Decorative dots */}
                <div className="absolute inset-0 pointer-events-none opacity-5"
                    style={{
                        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />

                {current === SLIDE_COVER && (
                    <CoverSlide isFullscreen={isFullscreen} />
                )}
                {current === SLIDE_STATS && (
                    <StatsSlide players={players} isFullscreen={isFullscreen} />
                )}
                {current >= PLAYER_OFFSET && (
                    <PlayerSlide
                        player={players[current - PLAYER_OFFSET]}
                        isFullscreen={isFullscreen}
                    />
                )}
            </div>

            {/* ── Controls bar ───────────────────────────────────────────── */}
            <div className={cls(
                'shrink-0 flex items-center gap-4 justify-between border-t border-white/10 bg-black/30 backdrop-blur-sm',
                isFullscreen ? 'px-16 py-5' : 'px-6 py-4',
            )}>
                {/* Prev */}
                <button
                    onClick={goPrev}
                    disabled={totalSlides <= 1}
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-30"
                >
                    <ChevronLeft size={18} />
                </button>

                {/* Dots + label */}
                <div className="flex flex-col items-center gap-3 flex-1">
                    {/* Dots */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        {/* Cover dot */}
                        <button
                            onClick={() => setCurrent(SLIDE_COVER)}
                            className={cls(
                                'rounded-full transition-all duration-300',
                                current === SLIDE_COVER
                                    ? 'w-6 h-2 bg-amber-400'
                                    : 'w-2 h-2 bg-white/30 hover:bg-white/60',
                            )}
                            title="Capa"
                        />
                        {/* Stats dot */}
                        <button
                            onClick={() => setCurrent(SLIDE_STATS)}
                            className={cls(
                                'rounded-full transition-all duration-300',
                                current === SLIDE_STATS
                                    ? 'w-6 h-2 bg-teal-400'
                                    : 'w-2 h-2 bg-white/30 hover:bg-white/60',
                            )}
                            title="Estatísticas"
                        />
                        {/* Player dots */}
                        {players.map((p, i) => (
                            <button
                                key={p.playerId}
                                onClick={() => setCurrent(i + PLAYER_OFFSET)}
                                className={cls(
                                    'rounded-full transition-all duration-300',
                                    current === i + PLAYER_OFFSET
                                        ? 'w-6 h-2 bg-white'
                                        : 'w-2 h-2 bg-white/30 hover:bg-white/60',
                                )}
                                title={p.name}
                            />
                        ))}
                    </div>

                    {/* Slide label */}
                    <span className="text-white/60 text-xs font-medium tracking-wide">
                        {current + 1} / {totalSlides} · {getSlideLabel(current)}
                    </span>
                </div>

                {/* Play / Pause */}
                <button
                    onClick={() => setPlaying(p => !p)}
                    className={cls(
                        'h-11 w-11 rounded-full flex items-center justify-center text-white transition shadow-lg',
                        playing
                            ? 'bg-white/20 hover:bg-white/30'
                            : 'bg-white/10 hover:bg-white/20',
                    )}
                    title={playing ? 'Pausar (Espaço)' : 'Play – avança a cada 8s (Espaço)'}
                >
                    {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>

                {/* Fullscreen toggle */}
                <button
                    onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                    title={isFullscreen ? 'Sair do fullscreen (Esc)' : 'Tela cheia + Play'}
                >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Next */}
                <button
                    onClick={goNext}
                    disabled={totalSlides <= 1}
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition disabled:opacity-30"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Progress bar when playing */}
            {playing && (
                <div
                    key={`${current}-progress`}
                    className="absolute bottom-0 left-0 h-0.5 bg-white/60 rounded-full"
                    style={{ animation: 'spotlight-progress 8s linear forwards' }}
                />
            )}

            <style>{`
                @keyframes spotlight-progress {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
            `}</style>
        </div>
    );
}
