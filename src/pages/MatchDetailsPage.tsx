import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";

/* ===================== helpers gerais ===================== */

function formatDate(date: string) {
    return new Date(date).toLocaleString("pt-BR");
}

function InviteStatusLabel(value: number) {
    switch (value) {
        case 1:
            return "Pendente";
        case 2:
            return "Recusado";
        case 3:
            return "Aceito";
        default:
            return String(value ?? "");
    }
}

function sortGoalkeepersFirst(players: any[]) {
    return [...(players ?? [])].sort((a, b) => {
        const ag = a?.isGoalkeeper ? 0 : 1;
        const bg = b?.isGoalkeeper ? 0 : 1;
        if (ag !== bg) return ag - bg;
        return String(a?.playerName ?? "").localeCompare(String(b?.playerName ?? ""), "pt-BR");
    });
}

type GoalTeam = "A" | "B" | "?";

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function safeHex(hex?: string) {
    if (!hex) return undefined;
    const v = String(hex).trim();
    if (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v)) return v;
    return undefined;
}

function normalizeHex3To6(hex: string) {
    const h = hex.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(h)) {
        return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    return h;
}

function isWhiteHex(hex?: string) {
    const h = hex ? normalizeHex3To6(hex) : "";
    return h === "#ffffff";
}

/** ✅ Contorno mais fino possível, mas só quando o time for branco */
function teamTextStyle(color: string): React.CSSProperties {
    const hex = safeHex(color) || color;
    if (isWhiteHex(hex)) {
        return {
            color: hex,
            textShadow:
                "0 1px 0 rgba(15,23,42,.9), 0 -1px 0 rgba(15,23,42,.9), 1px 0 0 rgba(15,23,42,.9), -1px 0 0 rgba(15,23,42,.9)",
        };
    }
    return { color: hex };
}

/** ✅ Swatch com borda + checker */
function ColorSwatch({
    color,
    size = 16,
    className,
    title,
}: {
    color?: string;
    size?: number;
    className?: string;
    title?: string;
}) {
    const hex = safeHex(color);
    const px = `${size}px`;

    return (
        <span
            title={title}
            className={cn("relative inline-block rounded border border-slate-300 overflow-hidden shadow-sm", className)}
            style={{ width: px, height: px }}
            aria-label={hex ? `Cor ${hex}` : "Sem cor"}
        >
            <span
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        "linear-gradient(45deg, rgba(148,163,184,.45) 25%, transparent 25%)," +
                        "linear-gradient(-45deg, rgba(148,163,184,.45) 25%, transparent 25%)," +
                        "linear-gradient(45deg, transparent 75%, rgba(148,163,184,.45) 75%)," +
                        "linear-gradient(-45deg, transparent 75%, rgba(148,163,184,.45) 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                }}
            />
            <span
                className="absolute inset-0"
                style={{
                    background: hex ?? "transparent",
                    opacity: hex ? 1 : 0,
                }}
            />
        </span>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: any;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-lg text-sm border transition",
                active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    );
}

/* ===================== timeline / clocks ===================== */

function cls(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}
function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

type Clock = { h: number; m: number; s: number; minOfDay: number };

/** ✅ parseClock robusto */
function parseClock(raw?: string | null): Clock | null {
    if (raw == null) return null;

    const v = String(raw)
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
        .trim();

    if (!v) return null;

    // pega primeiro HH:MM(:SS)
    const m = v.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;

    const h = Number(m[1]);
    const mm = Number(m[2]);
    const s = m[3] != null ? Number(m[3]) : 0;

    if (!Number.isFinite(h) || !Number.isFinite(mm) || !Number.isFinite(s)) return null;
    if (h < 0 || h > 23 || mm < 0 || mm > 59 || s < 0 || s > 59) return null;

    return { h, m: mm, s, minOfDay: h * 60 + mm };
}

function toHHMM(minOfDay: number) {
    const md = ((minOfDay % 1440) + 1440) % 1440;
    const h = Math.floor(md / 60);
    const m = md % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function diffSecClock(goal: Clock, startMinOfDay: number): number {
    let diffMin = goal.minOfDay - startMinOfDay;
    if (diffMin < 0) diffMin += 1440;
    return diffMin * 60 + goal.s;
}

/**
 * ✅ inferência do início (mantive sua ideia), mas agora SEM depender de timeSeconds.
 * E com desempate que favorece colocar o 1º gol o mais próximo de 0 possível.
 */
function inferStartMinOfDayFromGoals(goals: GoalDto[]): number | null {
    const clocks = (goals ?? []).map((g) => parseClock(g.time)).filter(Boolean) as Clock[];
    if (clocks.length === 0) return null;

    const hours = Array.from(new Set(clocks.map((c) => c.h))).sort((a, b) => a - b);
    const hourCandidates = new Set<number>();

    for (const h of hours) {
        hourCandidates.add(h);
        hourCandidates.add((h + 23) % 24);
        hourCandidates.add((h + 1) % 24);
    }

    const candidates: number[] = [];
    for (const h of hourCandidates) {
        candidates.push(h * 60 + 0);
        candidates.push(h * 60 + 30);
    }

    const uniq = Array.from(new Set(candidates)).sort((a, b) => a - b);

    // usaremos também o primeiro gol para desempatar (queremos ele mais perto do 0)
    const first = clocks.slice().sort((a, b) => a.minOfDay - b.minOfDay)[0];

    let best: { start: number; countIn: number; maxDiff: number; firstDiff: number } | null = null;

    for (const start of uniq) {
        let countIn = 0;
        let maxDiff = 0;

        for (const c of clocks) {
            const d = diffSecClock(c, start);
            if (d >= 0 && d <= 3600) {
                countIn += 1;
                if (d > maxDiff) maxDiff = d;
            }
        }

        const firstDiff = diffSecClock(first, start);

        const cand = { start, countIn, maxDiff, firstDiff };

        if (!best) {
            best = cand;
            continue;
        }

        if (cand.countIn > best.countIn) {
            best = cand;
            continue;
        }

        if (cand.countIn === best.countIn && cand.maxDiff < best.maxDiff) {
            best = cand;
            continue;
        }

        // 🔥 desempate extra: deixe o 1º gol mais perto do 0
        if (cand.countIn === best.countIn && cand.maxDiff === best.maxDiff && cand.firstDiff < best.firstDiff) {
            best = cand;
            continue;
        }

        if (
            cand.countIn === best.countIn &&
            cand.maxDiff === best.maxDiff &&
            cand.firstDiff === best.firstDiff &&
            cand.start < best.start
        ) {
            best = cand;
            continue;
        }
    }

    if (!best || best.countIn === 0) {
        return first.h * 60; // HH:00 do primeiro gol
    }

    return best.start;
}

type GoalDto = {
    goalId: string;
    scorerMatchPlayerId: string;
    scorerPlayerId: string;
    scorerName: string;
    assistMatchPlayerId?: string | null;
    assistPlayerId?: string | null;
    assistName?: string | null;
    time?: string | null;
};

type GoalEvent = GoalDto & {
    minute: number;
    tSec: number;
    team: 1 | 2 | 0;
};

/**
 * ✅ REGRA CORRETA:
 * - Usa SEMPRE g.time (relógio) quando existir
 * - NÃO usa timeSeconds aqui (você removeu, e era fonte do bug)
 */
function goalToGameSeconds(g: GoalDto, startMinOfDay: number | null): number | null {
    const c = parseClock(g.time);
    if (!c || startMinOfDay == null) return null;
    const d = diffSecClock(c, startMinOfDay);
    return clamp(d, 0, 3600);
}

type SimulationProps = {
    goals: GoalDto[];
    teamByPlayerId: Map<string, number>;
    teamAHex?: string;
    teamBHex?: string;
    totalMinutes?: number;
    durationMs?: number;
    autoPlay?: boolean;
};

export function MatchTimeSimulationTimeline({
    goals,
    teamByPlayerId,
    teamAHex = "#1d4ed8",
    teamBHex = "#f97316",
    totalMinutes = 60,
    durationMs = 15000,
    autoPlay = true,
}: SimulationProps) {
    const SIM_DURATION_MS = durationMs;

    const inferredStart = useMemo(() => inferStartMinOfDayFromGoals(goals ?? []), [goals]);

    const timeline = useMemo(() => {
        const list: GoalEvent[] = (goals ?? [])
            .map((g) => {
                const tSec = goalToGameSeconds(g, inferredStart) ?? totalMinutes * 60;
                const minute = clamp(Math.floor(tSec / 60), 0, totalMinutes);

                const teamRaw = teamByPlayerId.get(String(g.scorerPlayerId));
                const team = (teamRaw === 1 ? 1 : teamRaw === 2 ? 2 : 0) as 1 | 2 | 0;

                return { ...g, tSec, minute, team };
            })
            .sort((a, b) => a.tSec - b.tSec);

        return list;
    }, [goals, teamByPlayerId, totalMinutes, inferredStart]);

    const [running, setRunning] = useState<boolean>(!!autoPlay);
    const [elapsedMs, setElapsedMs] = useState<number>(0);

    const simSec = useMemo(() => {
        const p = SIM_DURATION_MS > 0 ? Math.min(1, elapsedMs / SIM_DURATION_MS) : 0;
        return p * (totalMinutes * 60);
    }, [elapsedMs, SIM_DURATION_MS, totalMinutes]);

    const simMinuteInt = clamp(Math.floor(simSec / 60), 0, totalMinutes);

    const visibleGoals = useMemo(() => timeline.filter((g) => g.tSec <= simSec), [timeline, simSec]);

    const scoreA = useMemo(() => visibleGoals.filter((g) => g.team === 1).length, [visibleGoals]);
    const scoreB = useMemo(() => visibleGoals.filter((g) => g.team === 2).length, [visibleGoals]);

    useEffect(() => {
        if (!running) return;

        let raf = 0;
        const start = performance.now() - elapsedMs;

        const tick = (now: number) => {
            const e = now - start;
            const clamped = clamp(e, 0, SIM_DURATION_MS);
            setElapsedMs(clamped);

            if (clamped >= SIM_DURATION_MS) {
                setRunning(false);
                return;
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, SIM_DURATION_MS]);

    function resetAndPlay() {
        setElapsedMs(0);
        setRunning(true);
    }

    const progressPct = SIM_DURATION_MS ? Math.min(100, (elapsedMs / SIM_DURATION_MS) * 100) : 0;

    const Btn = ({
        children,
        title,
        onClick,
        disabled,
    }: {
        children: any;
        title?: string;
        onClick: () => void;
        disabled?: boolean;
    }) => (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={cls(
                "h-9 px-3 rounded-lg border text-sm font-medium transition",
                disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50",
                "border-slate-200 bg-white text-slate-800"
            )}
        >
            {children}
        </button>
    );

    const Pill = ({ children }: { children: any }) => (
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800">
            {children}
        </span>
    );

    const renderBar = (teamLabel: string, team: 1 | 2, colorHex: string) => {
        const teamGoals = timeline.filter((g) => g.team === team);
        const totalTeamGoals = teamGoals.length;
        const currentTeamGoals = team === 1 ? scoreA : scoreB;

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <div className={cls("font-semibold", team === 1 ? "text-blue-700" : "text-orange-700")}>{teamLabel}</div>
                    <div className="text-slate-600 font-medium">
                        {currentTeamGoals}/{totalTeamGoals}
                    </div>
                </div>

                <div className="relative h-10">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-slate-100 border border-slate-200" />

                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full opacity-25"
                        style={{ width: `${progressPct}%`, backgroundColor: colorHex }}
                    />

                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1 pointer-events-none">
                        {Array.from({ length: 13 }).map((_, i) => (
                            <div key={i} className="h-5 w-px bg-slate-200" />
                        ))}
                    </div>

                    {teamGoals.map((g) => {
                        const leftPct = (g.tSec / (totalMinutes * 60)) * 100;
                        const isVisible = g.tSec <= simSec;

                        return (
                            <div
                                key={g.goalId}
                                className={cls(
                                    "absolute top-1/2 -translate-y-1/2",
                                    "transition-all duration-300",
                                    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
                                )}
                                style={{ left: `calc(${leftPct}% - 10px)` }}
                                title={`${g.minute}' • ${g.scorerName}${g.assistName ? ` (${g.assistName})` : ""} •`}
                            >
                                <div className="relative">
                                    <div
                                        className={cls("absolute -inset-1 rounded-full blur-[0.2px]", isVisible ? "animate-pulse" : "")}
                                        style={{ backgroundColor: colorHex, opacity: 0.25 }}
                                    />
                                    <div className="h-6 w-6 rounded-full grid place-items-center border bg-white shadow-sm" style={{ borderColor: colorHex }}>
                                        ⚽
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const startLabel = inferredStart == null ? "--:--" : toHHMM(inferredStart);
    const endLabel = inferredStart == null ? "--:--" : toHHMM(inferredStart + 60);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-semibold text-slate-900">Simulação do jogo</div>
                    <div className="text-xs text-slate-500">
                        {totalMinutes} minutos em <b>{Math.round(SIM_DURATION_MS / 1000)}s</b> • jogo inferido: <b>{startLabel}</b> → <b>{endLabel}</b>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm text-slate-900">
                        ⏱ {simMinuteInt}/{totalMinutes}
                    </div>

                    <Btn onClick={resetAndPlay} title="Reiniciar">
                        ↻
                    </Btn>

                    <Btn onClick={() => setRunning(true)} title="Play" disabled={running}>
                        ▶
                    </Btn>

                    <Btn onClick={() => setRunning(false)} title="Pause" disabled={!running}>
                        ❚❚
                    </Btn>
                </div>
            </div>

            <div className="mt-4 space-y-4">
                {renderBar("Time A", 1, teamAHex)}
                {renderBar("Time B", 2, teamBHex)}
            </div>
        </div>
    );
}

/* ===================== page ===================== */

export default function MatchDetailsPage() {
    const { groupId, matchId } = useParams<{ groupId: string; matchId: string }>();
    const [data, setData] = useState<any>(null);

    const [goalsTab, setGoalsTab] = useState<"gols" | "timeline" | "teamA" | "teamB">("gols");

    useEffect(() => {
        (async () => {
            if (!groupId || !matchId) return;
            const res = await MatchesApi.details(groupId, matchId);
            setData(res.data);
        })();
    }, [groupId, matchId]);

    const teamAPlayers = useMemo(() => sortGoalkeepersFirst(data?.teamAPlayers), [data]);
    const teamBPlayers = useMemo(() => sortGoalkeepersFirst(data?.teamBPlayers), [data]);

    const teamIndex = useMemo(() => {
        const byMatchPlayerId = new Map<string, GoalTeam>();
        const byPlayerId = new Map<string, GoalTeam>();

        for (const p of data?.teamAPlayers ?? []) {
            if (p?.matchPlayerId) byMatchPlayerId.set(p.matchPlayerId, "A");
            if (p?.playerId) byPlayerId.set(p.playerId, "A");
        }
        for (const p of data?.teamBPlayers ?? []) {
            if (p?.matchPlayerId) byMatchPlayerId.set(p.matchPlayerId, "B");
            if (p?.playerId) byPlayerId.set(p.playerId, "B");
        }

        return { byMatchPlayerId, byPlayerId };
    }, [data]);

    const teamByPlayerIdNum = useMemo(() => {
        const m = new Map<string, number>();
        for (const [playerId, t] of teamIndex.byPlayerId.entries()) {
            if (t === "A") m.set(playerId, 1);
            else if (t === "B") m.set(playerId, 2);
        }
        return m;
    }, [teamIndex]);

    /** ✅ ordenar por `time` (não por timeSeconds) */
    const sortedGoals = useMemo(() => {
        const goals = [...(data?.goals ?? [])].sort((a, b) => {
            const ca = parseClock(a?.time);
            const cb = parseClock(b?.time);
            const va = ca ? ca.minOfDay * 60 + ca.s : Number.POSITIVE_INFINITY;
            const vb = cb ? cb.minOfDay * 60 + cb.s : Number.POSITIVE_INFINITY;
            return va - vb;
        });

        return goals.map((g) => {
            const teamFromMatchPlayerId = g?.scorerMatchPlayerId && teamIndex.byMatchPlayerId.get(g.scorerMatchPlayerId);
            const teamFromPlayerId = g?.scorerPlayerId && teamIndex.byPlayerId.get(g.scorerPlayerId);
            const team: GoalTeam = (teamFromMatchPlayerId ?? teamFromPlayerId ?? "?") as GoalTeam;
            return { ...g, team };
        });
    }, [data, teamIndex]);

    const timeline = useMemo(() => {
        let a = 0;
        let b = 0;

        return sortedGoals.map((g: any, idx: number) => {
            if (g.team === "A") a += 1;
            else if (g.team === "B") b += 1;

            const leader = a === b ? "Empate" : a > b ? "Time A na frente" : "Time B na frente";

            return {
                idx: idx + 1,
                goalId: g.goalId,
                time: g.time,
                scorerName: g.scorerName,
                assistName: g.assistName,
                team: g.team as GoalTeam,
                scoreA: a,
                scoreB: b,
                leader,
            };
        });
    }, [sortedGoals]);

    const goalsForTab = useMemo(() => {
        if (goalsTab === "teamA") return sortedGoals.filter((g: any) => g.team === "A");
        if (goalsTab === "teamB") return sortedGoals.filter((g: any) => g.team === "B");
        return sortedGoals;
    }, [sortedGoals, goalsTab]);

    const aColor = safeHex(data?.teamAColor?.hexValue) || "#0f172a";
    const bColor = safeHex(data?.teamBColor?.hexValue) || "#0f172a";

    if (!data) {
        return (
            <div className="space-y-6">
                <Section title="Detalhes da partida">
                    <div className="text-sm text-slate-500">Carregando...</div>
                </Section>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Section title="Placar">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <div className="text-sm text-slate-500">{data.groupName}</div>
                            <div className="text-lg font-semibold text-slate-900">{data.placeName}</div>
                            <div className="text-xs text-slate-500">{data.playedAt ? formatDate(data.playedAt) : "-"}</div>
                        </div>

                        <div className="text-center min-w-[260px]">
                            <div className="text-4xl font-bold">
                                <span style={teamTextStyle(aColor)}>{data.teamAGoals ?? "-"}</span>{" "}
                                <span className="text-slate-400">x</span>{" "}
                                <span style={teamTextStyle(bColor)}>{data.teamBGoals ?? "-"}</span>
                            </div>

                            <div className="text-sm text-slate-500">{data.status}</div>

                            <div className="mt-4 text-left">
                                <MatchTimeSimulationTimeline
                                    goals={(data?.goals ?? []) as GoalDto[]}
                                    teamByPlayerId={teamByPlayerIdNum}
                                    teamAHex={aColor}
                                    teamBHex={bColor}
                                    totalMinutes={60}
                                    durationMs={5000}
                                    autoPlay
                                />
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 text-right max-w-[280px]">
                            <div className="font-medium text-slate-700">MatchId</div>
                            <div className="break-all">{data.matchId}</div>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Informações Gerais">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-slate-700">
                            <b>GroupId:</b> <span className="text-slate-600 break-all">{data.groupId}</span>
                        </div>
                        <div className="text-slate-700 mt-2">
                            <b>Status:</b> <span className="text-slate-600">{data.statusName}</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-slate-700">
                            <b>Cor Time A:</b>
                            <span className="text-slate-600">{data.teamAColor?.name ?? "-"}</span>
                            <ColorSwatch color={aColor} size={16} title={`Time A ${aColor}`} />
                        </div>

                        <div className="flex items-center gap-2 text-slate-700 mt-2">
                            <b>Cor Time B:</b>
                            <span className="text-slate-600">{data.teamBColor?.name ?? "-"}</span>
                            <ColorSwatch color={bColor} size={16} title={`Time B ${bColor}`} />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Escalação">
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold mb-3 flex items-center gap-2">
                            <ColorSwatch color={aColor} size={14} title={`Time A ${aColor}`} />
                            <span style={teamTextStyle(aColor)}>
                                Time A <span className="text-slate-400 font-normal">({teamAPlayers.length})</span>
                            </span>
                        </div>

                        <ul className="space-y-2 text-sm">
                            {teamAPlayers.map((p: any) => (
                                <li key={p.matchPlayerId} className="flex items-center justify-between gap-3">
                                    <span className="text-slate-800 flex items-center gap-2">
                                        <span>{p.playerName}</span>
                                        {p.isGoalkeeper && <span title="Goleiro">🧤</span>}
                                    </span>
                                    <span className="text-slate-500 text-xs">{InviteStatusLabel(p.inviteResponse)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold mb-3 flex items-center gap-2">
                            <ColorSwatch color={bColor} size={14} title={`Time B ${bColor}`} />
                            <span style={teamTextStyle(bColor)}>
                                Time B <span className="text-slate-400 font-normal">({teamBPlayers.length})</span>
                            </span>
                        </div>

                        <ul className="space-y-2 text-sm">
                            {teamBPlayers.map((p: any) => (
                                <li key={p.matchPlayerId} className="flex items-center justify-between gap-3">
                                    <span className="text-slate-800 flex items-center gap-2">
                                        <span>{p.playerName}</span>
                                        {p.isGoalkeeper && <span title="Goleiro">🧤</span>}
                                    </span>
                                    <span className="text-slate-500 text-xs">{InviteStatusLabel(p.inviteResponse)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Section>

            <Section title="Gols">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <TabButton active={goalsTab === "gols"} onClick={() => setGoalsTab("gols")}>
                            Gols ({sortedGoals.length})
                        </TabButton>
                        <TabButton active={goalsTab === "timeline"} onClick={() => setGoalsTab("timeline")}>
                            Linha do tempo
                        </TabButton>
                        <TabButton active={goalsTab === "teamA"} onClick={() => setGoalsTab("teamA")}>
                            Time A
                        </TabButton>
                        <TabButton active={goalsTab === "teamB"} onClick={() => setGoalsTab("teamB")}>
                            Time B
                        </TabButton>
                    </div>

                    {goalsTab !== "timeline" ? (
                        <div className="space-y-2 text-sm">
                            {goalsForTab.length === 0 ? (
                                <div className="text-slate-500">Nenhum gol para exibir.</div>
                            ) : (
                                goalsForTab.map((g: any) => (
                                    <div key={g.goalId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                                        <div className="text-slate-800">
                                            <span className="mr-2" aria-hidden>
                                                ⚽
                                            </span>
                                            <span className="font-medium">{g.scorerName ?? "-"}</span>
                                            {g.assistName ? (
                                                <span className="text-slate-600">
                                                    {" "}
                                                    <span className="mx-1" aria-hidden>
                                                        🤝
                                                    </span>
                                                    {g.assistName}
                                                </span>
                                            ) : null}
                                            {g.time ? <span className="text-slate-500"> - {g.time}</span> : null}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2 text-sm">
                            {timeline.length === 0 ? (
                                <div className="text-slate-500">Nenhum gol registrado.</div>
                            ) : (
                                timeline.map((t: any) => (
                                    <div key={t.goalId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                                        <div className="text-slate-800">
                                            <span className="text-slate-400 mr-2">#{t.idx}</span>
                                            <span className="mr-2" aria-hidden>
                                                ⚽
                                            </span>
                                            <span className="font-medium">{t.scorerName ?? "-"}</span>
                                            {t.assistName ? (
                                                <span className="text-slate-600">
                                                    {" "}
                                                    <span className="mx-1" aria-hidden>
                                                        🤝
                                                    </span>
                                                    {t.assistName}
                                                </span>
                                            ) : null}
                                            {t.time ? <span className="text-slate-500"> — {t.time}</span> : null}
                                        </div>

                                        <div className="text-right">
                                            <div className="font-semibold">
                                                <span style={teamTextStyle(aColor)}>{t.scoreA}</span> <span className="text-slate-400">x</span>{" "}
                                                <span style={teamTextStyle(bColor)}>{t.scoreB}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">{t.leader}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </Section>

            <Section title="Votação">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div>
                        <b>MVP:</b>{" "}
                        {data.computedMvp?.playerName
                            ? `${data.computedMvp.playerName}${data.computedMvp.team ? ` (Time ${data.computedMvp.team === 1 ? "A" : data.computedMvp.team === 2 ? "B" : "?"})` : ""
                            }`
                            : "—"}
                    </div>

                    <div className="mt-1">
                        <b>votes:</b> {data.votes?.length ?? 0}
                    </div>

                    <div className="mt-1">
                        <b>voteCounts:</b> {data.voteCounts?.length ?? 0}
                    </div>
                </div>
            </Section>
        </div>
    );
}