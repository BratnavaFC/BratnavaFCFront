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
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

/** Duas iniciais do nome */
function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

/** Gradiente do avatar baseado no win rate */
function avatarGradient(wr: number): string {
    if (wr >= 0.60) return 'from-emerald-500 to-emerald-700';
    if (wr >= 0.45) return 'from-amber-500 to-amber-700';
    return 'from-rose-500 to-rose-700';
}

/** Cor do texto do win rate */
function wrTextColor(wr: number): string {
    if (wr >= 0.60) return 'text-emerald-400';
    if (wr >= 0.45) return 'text-amber-400';
    return 'text-rose-400';
}

/** Cor do glow de fundo do slide do jogador */
function wrGlowRgba(wr: number): string {
    if (wr >= 0.60) return 'rgba(52,211,153,0.13)';
    if (wr >= 0.45) return 'rgba(251,191,36,0.13)';
    return 'rgba(248,113,113,0.11)';
}

/** Gradiente da barra de win rate */
function wrBarGradient(wr: number): string {
    if (wr >= 0.60) return 'from-emerald-500 to-emerald-400';
    if (wr >= 0.45) return 'from-amber-500 to-amber-400';
    return 'from-rose-600 to-rose-400';
}

// ── CoverSlide ─────────────────────────────────────────────────────────────────
function CoverSlide({ isFullscreen }: { isFullscreen: boolean }) {
    const today = formatDate(new Date());

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none">
            {/* Radial amber glow */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(217,119,6,0.22) 0%, transparent 70%)' }} />

            {/* Dot grid */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

            {/* Logo */}
            <div className={cls('relative z-10', isFullscreen ? 'w-56 h-56 mb-8' : 'w-36 h-36 mb-5')}>
                <img
                    src={`${import.meta.env.BASE_URL}bratnava-logo.png`}
                    alt="Bratnava FC"
                    className="w-full h-full object-contain"
                    style={{ filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.55))' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
            </div>

            {/* Badge edição */}
            <div className="relative z-10 mb-4 px-4 py-1 rounded-full border border-amber-400/40 bg-amber-400/10">
                <span className={cls('font-bold tracking-[0.2em] uppercase text-amber-300', isFullscreen ? 'text-xl' : 'text-xs')}>
                    2ª Edição
                </span>
            </div>

            {/* Título */}
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

            {/* Divider */}
            <div className="relative z-10 my-5 flex items-center gap-3 w-64">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-400/50" />
                <span className={cls('text-amber-400/70', isFullscreen ? 'text-2xl' : 'text-lg')}>🍔</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-400/50" />
            </div>

            {/* Data */}
            <p className={cls('relative z-10 text-white/70 font-semibold capitalize tracking-widest', isFullscreen ? 'text-2xl' : 'text-sm')}>
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
    barClass,
    isFullscreen,
}: {
    icon: any;
    label: string;
    items: { name: string; value: string | number; rank: number }[];
    valueLabel: string;
    accentClass: string;
    barClass: string;
    isFullscreen: boolean;
}) {
    const maxVal = items.length > 0 ? Math.max(...items.map(i => Number(i.value) || 0)) : 1;
    const fs = isFullscreen;

    return (
        <div className={cls('flex flex-col', fs ? 'gap-4' : 'gap-2.5')}>
            {/* Cabeçalho */}
            <div className={cls('flex items-center gap-2 font-bold uppercase tracking-widest', accentClass, fs ? 'text-base' : 'text-[11px]')}>
                <Icon size={fs ? 18 : 13} />
                <span>{label}</span>
            </div>

            {items.length === 0 ? (
                <p className={cls('text-white/25 italic', fs ? 'text-lg' : 'text-sm')}>Sem dados</p>
            ) : (
                <ol className={cls(fs ? 'space-y-4' : 'space-y-2')}>
                    {Object.values(
                        items.reduce<Record<number, typeof items>>((acc, item) => {
                            (acc[item.rank] ??= []).push(item);
                            return acc;
                        }, {})
                    ).map(group => {
                        const { rank, value } = group[0];
                        const names = group.map(g => g.name).join(' | ');
                        const barW = maxVal > 0 ? (Number(value) / maxVal) * 100 : 0;
                        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                        return (
                            <li key={rank}>
                                <div className="flex items-center gap-2">
                                    <span className={cls('font-black shrink-0 text-center leading-none', rank > 3 ? 'text-white/25' : '', fs ? 'text-xl w-8' : 'text-sm w-6')}>
                                        {rankEmoji ?? `${rank}.`}
                                    </span>
                                    <span className={cls('text-white font-semibold flex-1 truncate leading-tight', fs ? 'text-xl' : 'text-sm')}>{names}</span>
                                    <span className={cls('font-bold shrink-0', accentClass, fs ? 'text-xl' : 'text-sm')}>
                                        {value}
                                        {valueLabel && <span className={cls('text-white/30 font-normal ml-0.5', fs ? 'text-sm' : 'text-[10px]')}>{valueLabel}</span>}
                                    </span>
                                </div>
                                {/* Barra de comparação */}
                                <div className={cls('rounded-full bg-white/[0.06] overflow-hidden mt-1', fs ? 'ml-10 h-2' : 'ml-[26px] h-1')}>
                                    <div
                                        className={cls('h-full rounded-full', barClass)}
                                        style={{ width: `${barW}%`, transition: 'width 0.5s ease-out' }}
                                    />
                                </div>
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
    const top5WinRate   = topNRanked(
        mensalistas.filter(p => p.gamesPlayed >= 5).map(p => ({ name: p.name, value: Math.round(p.winRate * 100) }))
    ).map(p => ({ ...p, value: `${p.value}%` }));

    const stats = [
        { icon: Footprints, label: 'Presenças',          items: top5Presencas, valueLabel: 'j',  accentClass: 'text-sky-400',     barClass: 'bg-sky-500/60' },
        { icon: Goal,       label: 'Gols',               items: top5Gols,      valueLabel: '',   accentClass: 'text-emerald-400', barClass: 'bg-emerald-500/60' },
        { icon: Handshake,  label: 'Assistências',       items: top5Assists,   valueLabel: '',   accentClass: 'text-purple-400',  barClass: 'bg-purple-500/60' },
        { icon: BarChart3,  label: 'Win Rate (≥5j)',     items: top5WinRate,   valueLabel: '',   accentClass: 'text-amber-400',   barClass: 'bg-amber-500/60' },
        { icon: Trophy,     label: 'Vitórias',           items: top5Vitorias,  valueLabel: '',   accentClass: 'text-yellow-400',  barClass: 'bg-yellow-500/60' },
        { icon: Medal,      label: 'MVPs',               items: top5Mvps,      valueLabel: '',   accentClass: 'text-rose-400',    barClass: 'bg-rose-500/60' },
    ];

    return (
        <div className={cls('w-full h-full flex flex-col', isFullscreen ? 'p-10 md:p-14' : 'p-5 md:p-7')}>
            {/* Cabeçalho */}
            <div className={cls('flex items-center gap-3', isFullscreen ? 'mb-8' : 'mb-5')}>
                <div className={cls('rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0', isFullscreen ? 'h-14 w-14' : 'h-9 w-9')}>
                    <Trophy size={isFullscreen ? 28 : 18} className="text-amber-400" />
                </div>
                <div>
                    <h2 className={cls('font-black text-white leading-none', isFullscreen ? 'text-5xl' : 'text-2xl')}>
                        Estatísticas da Patota
                    </h2>
                    <p className={cls('text-white/35 font-medium mt-0.5 tracking-wide', isFullscreen ? 'text-base' : 'text-[11px]')}>
                        Top 5 · apenas mensalistas
                    </p>
                </div>
            </div>

            {/* Grid 3×2 */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 flex-1">
                {stats.map(s => (
                    <StatsTopList
                        key={s.label}
                        icon={s.icon}
                        label={s.label}
                        items={s.items}
                        valueLabel={s.valueLabel}
                        accentClass={s.accentClass}
                        barClass={s.barClass}
                        isFullscreen={isFullscreen}
                    />
                ))}
            </div>
        </div>
    );
}

// ── RelationList ───────────────────────────────────────────────────────────────
function RelationList({
    icon: Icon,
    label,
    items,
    renderExtra,
    getBarValue,
    maxBarValue,
    emptyMsg,
    accentClass,
    barClass,
    isFullscreen,
}: {
    icon: any;
    label: string;
    items: SpotlightRelation[];
    renderExtra: (r: SpotlightRelation) => React.ReactNode;
    getBarValue: (r: SpotlightRelation) => number;
    maxBarValue?: number;
    emptyMsg: string;
    accentClass: string;
    barClass: string;
    isFullscreen: boolean;
}) {
    const maxVal = maxBarValue ?? 1;
    const fs = isFullscreen;

    return (
        <div className={cls('flex flex-col', fs ? 'gap-4' : 'gap-2')}>
            <div className={cls('flex items-center gap-1.5 font-bold uppercase tracking-widest', accentClass, fs ? 'text-base' : 'text-[11px]')}>
                <Icon size={fs ? 18 : 13} />
                <span>{label}</span>
            </div>
            {items.length === 0 ? (
                <p className={cls('text-white/25 italic', fs ? 'text-xl' : 'text-sm')}>{emptyMsg}</p>
            ) : (
                <ol className={cls(fs ? 'space-y-4' : 'space-y-1.5')}>
                    {items.map((r, i) => {
                        const barW = Math.min((getBarValue(r) / maxVal) * 100, 100);
                        return (
                            <li key={r.playerId}>
                                <div className={cls('flex items-center', fs ? 'gap-2.5' : 'gap-1.5')}>
                                    <span className={cls('text-white/30 shrink-0 text-right font-medium', fs ? 'text-lg w-7' : 'text-[11px] w-4')}>{i + 1}.</span>
                                    <span className={cls('text-white font-semibold flex-1 truncate leading-tight', fs ? 'text-xl' : 'text-sm')}>{r.name}</span>
                                    {renderExtra(r)}
                                </div>
                                <div className={cls('rounded-full bg-white/[0.06] overflow-hidden', fs ? 'ml-11 mt-1 h-1.5' : 'ml-[22px] mt-0.5 h-0.5')}>
                                    <div
                                        className={cls('h-full rounded-full', barClass)}
                                        style={{ width: `${barW}%` }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

// ── PlayerSlide ────────────────────────────────────────────────────────────────
function PlayerSlide({ player, isFullscreen }: { player: PlayerSpotlightItem; isFullscreen: boolean }) {
    const wr = player.winRate;
    const fs = isFullscreen;

    return (
        <div className={cls('w-full h-full flex flex-col relative', fs ? 'p-10 md:p-14' : 'p-5 md:p-7')}>
            {/* Glow de fundo baseado no win rate */}
            <div
                className="absolute top-0 left-0 right-0 h-72 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 80% 110% at 25% -10%, ${wrGlowRgba(wr)} 0%, transparent 70%)` }}
            />

            {/* ── Cabeçalho ── */}
            <div className={cls('relative flex flex-col sm:flex-row sm:items-start', fs ? 'gap-6 mb-8' : 'gap-4 mb-5')}>
                {/* Avatar + nome */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cls(
                        'rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 font-black text-white select-none shadow-lg',
                        avatarGradient(wr),
                        fs ? 'w-24 h-24 text-4xl' : 'w-14 h-14 text-xl',
                    )}>
                        {player.isGoalkeeper ? '🧤' : getInitials(player.name)}
                    </div>
                    <div className="min-w-0">
                        <h2 className={cls(
                            'font-black text-white leading-none truncate',
                            fs ? 'text-6xl' : 'text-4xl md:text-5xl',
                        )}>
                            {player.name}
                        </h2>
                        <p className={cls('text-white/40 font-medium mt-1 flex items-center gap-2', fs ? 'text-xl' : 'text-sm')}>
                            <span>{player.isGoalkeeper ? '🧤 Goleiro' : '⚽ Linha'}</span>
                            {player.isGuest && (
                                <span className={cls('rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/25 font-semibold', fs ? 'text-sm px-3 py-1' : 'text-[10px] px-1.5 py-0.5')}>
                                    Convidado
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Cards de estatísticas rápidas */}
                <div className={cls('flex flex-wrap', fs ? 'gap-3' : 'gap-2')}>
                    {/* Partidas */}
                    <div className={cls('bg-white/[0.07] border border-white/10 rounded-2xl', fs ? 'px-7 py-5' : 'px-4 py-3')}>
                        <div className={cls('text-white/30 font-bold uppercase tracking-widest', fs ? 'text-sm mb-4' : 'text-[10px] mb-2')}>
                            Partidas
                        </div>
                        <div className={cls('flex items-end', fs ? 'gap-5' : 'gap-3')}>
                            <div className="text-center">
                                <div className={cls('text-white font-black leading-none', fs ? 'text-5xl' : 'text-2xl')}>{player.gamesPlayed}</div>
                                <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>total</div>
                            </div>
                            <div className="w-px self-stretch bg-white/10" />
                            <div className={cls('flex', fs ? 'gap-4' : 'gap-2.5')}>
                                <div className="text-center">
                                    <div className={cls('text-emerald-400 font-bold leading-none', fs ? 'text-3xl' : 'text-lg')}>{player.wins}</div>
                                    <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>V</div>
                                </div>
                                <div className="text-center">
                                    <div className={cls('text-amber-300 font-bold leading-none', fs ? 'text-3xl' : 'text-lg')}>{player.ties}</div>
                                    <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>E</div>
                                </div>
                                <div className="text-center">
                                    <div className={cls('text-rose-400 font-bold leading-none', fs ? 'text-3xl' : 'text-lg')}>{player.losses}</div>
                                    <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>D</div>
                                </div>
                            </div>
                            <div className="w-px self-stretch bg-white/10" />
                            {/* Win rate com barra */}
                            <div className={cls('text-center', fs ? 'min-w-[72px]' : 'min-w-[44px]')}>
                                <div className={cls('font-black leading-none', wrTextColor(wr), fs ? 'text-5xl' : 'text-2xl')}>{pct(wr)}</div>
                                <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>win%</div>
                                <div className={cls('mt-1.5 rounded-full bg-white/10 overflow-hidden', fs ? 'h-2' : 'h-1')}>
                                    <div
                                        className={cls('h-full rounded-full bg-gradient-to-r', wrBarGradient(wr))}
                                        style={{ width: `${wr * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desempenho */}
                    <div className={cls('bg-white/[0.07] border border-white/10 rounded-2xl', fs ? 'px-7 py-5' : 'px-4 py-3')}>
                        <div className={cls('text-white/30 font-bold uppercase tracking-widest', fs ? 'text-sm mb-4' : 'text-[10px] mb-2')}>
                            Desempenho
                        </div>
                        <div className={cls('flex items-end', fs ? 'gap-5' : 'gap-3')}>
                            <div className="text-center">
                                <div className={cls('text-white font-black leading-none', fs ? 'text-5xl' : 'text-2xl')}>{player.goals}</div>
                                <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>gols</div>
                            </div>
                            <div className="w-px self-stretch bg-white/10" />
                            <div className="text-center">
                                <div className={cls('text-white font-black leading-none', fs ? 'text-5xl' : 'text-2xl')}>{player.assists}</div>
                                <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>assist.</div>
                            </div>
                            {player.mvps > 0 && (
                                <>
                                    <div className="w-px self-stretch bg-white/10" />
                                    <div className="text-center">
                                        <div className={cls('text-yellow-300 font-black leading-none', fs ? 'text-5xl' : 'text-2xl')}>{player.mvps}</div>
                                        <div className={cls('text-white/30 mt-0.5', fs ? 'text-sm' : 'text-[10px]')}>MVP</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Grid de relações (3×2) ── */}
            <div className={cls('grid grid-cols-2 lg:grid-cols-3 flex-1', fs ? 'gap-5 lg:gap-6' : 'gap-3 lg:gap-4')}>
                <RelationList
                    icon={Handshake}  label="Melhores parceiros"
                    items={player.bestPartners}   accentClass="text-emerald-400" barClass="bg-emerald-500/60"
                    emptyMsg="Sem dados suficientes" getBarValue={r => r.rate}
                    isFullscreen={fs}
                    renderExtra={r => <span className={cls('text-emerald-300 font-bold shrink-0', fs ? 'text-base' : 'text-xs')}>{pct(r.rate)}</span>}
                />
                <RelationList
                    icon={TrendingDown} label="Piores parceiros"
                    items={player.worstPartners}  accentClass="text-orange-400" barClass="bg-orange-500/60"
                    emptyMsg="Sem dados suficientes" getBarValue={r => r.rate}
                    isFullscreen={fs}
                    renderExtra={r => <span className={cls('text-orange-300 font-bold shrink-0', fs ? 'text-base' : 'text-xs')}>{pct(r.rate)}</span>}
                />
                <RelationList
                    icon={Swords} label="Mais me vencem"
                    items={player.mostBeatenBy}   accentClass="text-red-400" barClass="bg-red-500/60"
                    emptyMsg="Sem dados suficientes" getBarValue={r => r.rate}
                    isFullscreen={fs}
                    renderExtra={r => <span className={cls('text-red-300 font-bold shrink-0', fs ? 'text-base' : 'text-xs')}>{pct(r.rate)}</span>}
                />
                <RelationList
                    icon={Shield} label="Mais venci"
                    items={player.leastBeatenBy}  accentClass="text-sky-400" barClass="bg-sky-500/60"
                    emptyMsg="Sem dados suficientes" getBarValue={r => r.rate}
                    isFullscreen={fs}
                    renderExtra={r => <span className={cls('text-sky-300 font-bold shrink-0', fs ? 'text-base' : 'text-xs')}>{pct(r.rate)}</span>}
                />
                <RelationList
                    icon={Star} label="Mais me assistiram"
                    items={player.mostAssistedBy} accentClass="text-yellow-400" barClass="bg-yellow-500/60"
                    emptyMsg="Sem gols assistidos" getBarValue={r => r.count}
                    maxBarValue={Math.max(...player.mostAssistedBy.map(r => r.count), 1)}
                    isFullscreen={fs}
                    renderExtra={r => <span className={cls('text-yellow-300 font-bold shrink-0', fs ? 'text-base' : 'text-xs')}>{r.count}×</span>}
                />
                <RelationList
                    icon={Trophy} label="Mais assisti"
                    items={player.mostAssistedTo} accentClass="text-purple-400" barClass="bg-purple-500/60"
                    emptyMsg="Sem assistências dadas" getBarValue={r => r.count}
                    maxBarValue={Math.max(...player.mostAssistedTo.map(r => r.count), 1)}
                    isFullscreen={fs}
                    renderExtra={r => <span className={cls('text-purple-300 font-bold shrink-0', fs ? 'text-base' : 'text-xs')}>{r.count}×</span>}
                />
            </div>
        </div>
    );
}

// ── Constants ──────────────────────────────────────────────────────────────────
const SLIDE_COVER  = 0;
const SLIDE_STATS  = 1;
const PLAYER_OFFSET = 2;

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PlayerSpotlightPage() {
    const active  = useAccountStore(s => s.getActive());
    const groupId = active?.activeGroupId ?? '';

    const [players, setPlayers]           = useState<PlayerSpotlightItem[]>([]);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [current, setCurrent]           = useState(0);
    const [playing, setPlaying]           = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [timerKey, setTimerKey]         = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const touchStartX  = useRef(0);

    const totalSlides = players.length + PLAYER_OFFSET;

    // ── Carregamento ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!groupId) return;
        setLoading(true);
        TeamGenApi.spotlight(groupId)
            .then(res => {
                const data = ((res.data.data as any)?.players ?? []).filter((p: any) => !p.isGuest);
                setPlayers(data);
                setCurrent(0);
            })
            .catch(() => setError('Erro ao carregar dados do spotlight.'))
            .finally(() => setLoading(false));
    }, [groupId]);

    // ── Navegação ─────────────────────────────────────────────────────────────
    const goNext = useCallback(() => setCurrent(c => (c + 1) % (totalSlides || 1)), [totalSlides]);
    const goPrev = useCallback(() => setCurrent(c => (c - 1 + (totalSlides || 1)) % (totalSlides || 1)), [totalSlides]);

    const handleNext = useCallback(() => { goNext(); setTimerKey(k => k + 1); }, [goNext]);
    const handlePrev = useCallback(() => { goPrev(); setTimerKey(k => k + 1); }, [goPrev]);
    const goTo = useCallback((idx: number) => { setCurrent(idx); setTimerKey(k => k + 1); }, []);

    // ── Auto-avanço ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (playing && totalSlides > 1) {
            intervalRef.current = setInterval(goNext, 8000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [playing, totalSlides, goNext, timerKey]);

    // ── Fullscreen ────────────────────────────────────────────────────────────
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
        const onChange = () => {
            const el = document.fullscreenElement ?? (document as any).webkitFullscreenElement;
            if (!el) { setIsFullscreen(false); setPlaying(false); }
        };
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    // ── Teclado ───────────────────────────────────────────────────────────────
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft')  handlePrev();
            if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
            if (e.key === 'Escape' && isFullscreen) exitFullscreen();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleNext, handlePrev, isFullscreen, exitFullscreen]);

    // ── Estados de erro/vazio ─────────────────────────────────────────────────
    if (!groupId) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Selecione uma patota pelo seletor no topo.
            </div>
        );
    }
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm">Carregando spotlight...</span>
            </div>
        );
    }
    if (error) {
        return <div className="text-rose-500 p-6 text-sm">{error}</div>;
    }
    if (players.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                <Users size={36} className="opacity-30" />
                <p className="text-sm">Nenhum dado disponível. Finalize algumas partidas primeiro.</p>
            </div>
        );
    }

    // ── Gradientes por slide ──────────────────────────────────────────────────
    const gradients = [
        'from-slate-900 via-amber-950 to-orange-950',   // capa
        'from-slate-900 via-teal-950 to-slate-900',     // stats
        'from-slate-900 via-indigo-950 to-slate-900',
        'from-slate-900 via-emerald-950 to-slate-900',
        'from-slate-900 via-purple-950 to-slate-900',
        'from-slate-900 via-rose-950 to-slate-900',
        'from-slate-900 via-sky-950 to-slate-900',
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

    return (
        <div
            ref={containerRef}
            className={cls(
                'relative flex flex-col bg-gradient-to-br transition-colors duration-700',
                getGradient(current),
                isFullscreen ? 'fixed inset-0 z-50' : 'rounded-2xl overflow-hidden min-h-[560px]',
            )}
        >
            {/* ── Área do slide ── */}
            <div
                className="flex-1 overflow-hidden relative"
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                    const dx = e.changedTouches[0].clientX - touchStartX.current;
                    if (dx > 50) handlePrev();
                    if (dx < -50) handleNext();
                }}
            >
                {/* Grid decorativo */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                {/* Slide com fade-in */}
                <div key={current} className="w-full h-full spotlight-fade">
                    {current === SLIDE_COVER && <CoverSlide isFullscreen={isFullscreen} />}
                    {current === SLIDE_STATS && <StatsSlide players={players} isFullscreen={isFullscreen} />}
                    {current >= PLAYER_OFFSET && (
                        <PlayerSlide player={players[current - PLAYER_OFFSET]} isFullscreen={isFullscreen} />
                    )}
                </div>
            </div>

            {/* ── Barra de progresso ── */}
            <div className="shrink-0 h-[3px] bg-white/[0.06] overflow-hidden">
                {playing && (
                    <div
                        key={`${current}-${timerKey}`}
                        className="h-full bg-white/40 rounded-full"
                        style={{ animation: 'spotlight-progress 8s linear forwards' }}
                    />
                )}
            </div>

            {/* ── Barra de controles ── */}
            <div className={cls(
                'shrink-0 flex items-center gap-3 border-t border-white/10 bg-black/20 backdrop-blur-sm',
                isFullscreen ? 'px-16 py-5' : 'px-4 py-3',
            )}>
                {/* Anterior */}
                <button
                    onClick={handlePrev}
                    disabled={totalSlides <= 1}
                    title="Anterior (←)"
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all disabled:opacity-30 shrink-0"
                >
                    <ChevronLeft size={18} />
                </button>

                {/* Centro: dots + rótulo */}
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        {/* Capa */}
                        <button
                            onClick={() => goTo(SLIDE_COVER)}
                            title="Capa"
                            className={cls('rounded-full transition-all duration-300',
                                current === SLIDE_COVER ? 'w-5 h-2 bg-amber-400' : 'w-2 h-2 bg-white/25 hover:bg-white/50')}
                        />
                        {/* Stats */}
                        <button
                            onClick={() => goTo(SLIDE_STATS)}
                            title="Estatísticas"
                            className={cls('rounded-full transition-all duration-300',
                                current === SLIDE_STATS ? 'w-5 h-2 bg-teal-400' : 'w-2 h-2 bg-white/25 hover:bg-white/50')}
                        />
                        {/* Separador visual */}
                        {players.length > 0 && (
                            <div className="w-px h-3 bg-white/15 mx-0.5 shrink-0" />
                        )}
                        {/* Jogadores */}
                        {players.map((p, i) => (
                            <button
                                key={p.playerId}
                                onClick={() => goTo(i + PLAYER_OFFSET)}
                                title={p.name}
                                className={cls('rounded-full transition-all duration-300',
                                    current === i + PLAYER_OFFSET ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/25 hover:bg-white/50')}
                            />
                        ))}
                    </div>
                    <span className="text-white/45 text-[11px] font-medium tracking-wide truncate max-w-full">
                        {current + 1} / {totalSlides} · {getSlideLabel(current)}
                    </span>
                </div>

                {/* Play / Pause */}
                <button
                    onClick={() => setPlaying(p => !p)}
                    title={playing ? 'Pausar (Espaço)' : 'Reproduzir — avança a cada 8s (Espaço)'}
                    className={cls(
                        'h-9 w-9 rounded-full flex items-center justify-center text-white transition-all active:scale-95 shrink-0',
                        playing ? 'bg-white/25 hover:bg-white/35' : 'bg-white/10 hover:bg-white/20',
                    )}
                >
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>

                {/* Fullscreen */}
                <button
                    onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                    title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all shrink-0"
                >
                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                {/* Próximo */}
                <button
                    onClick={handleNext}
                    disabled={totalSlides <= 1}
                    title="Próximo (→)"
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all disabled:opacity-30 shrink-0"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            <style>{`
                @keyframes spotlight-progress {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
                .spotlight-fade {
                    animation: spotlightFadeIn 0.3s ease-out both;
                }
                @keyframes spotlightFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
