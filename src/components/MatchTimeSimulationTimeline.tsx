import React, { useEffect, useMemo, useState } from "react";

type GoalDto = {
    goalId: string;
    scorerMatchPlayerId: string;
    scorerPlayerId: string;
    scorerName: string;
    assistMatchPlayerId?: string | null;
    assistPlayerId?: string | null;
    assistName?: string | null;
    time?: string | null; // "21:05" ou "21:05:12"
};

function cls(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}
function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

/** ===== cor/white ===== */
function normalizeHex3To6(hex: string) {
    const h = String(hex || "").trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    return h;
}
function normalizeHex(input?: string) {
    const v = String(input ?? "").trim();
    if (!v) return "#000000";
    const withHash = v.startsWith("#") ? v : `#${v}`;
    return normalizeHex3To6(withHash);
}
function isWhiteHex(hex?: string) {
    return normalizeHex(hex) === "#ffffff";
}

/** ===== relógio ===== */
type Clock = { h: number; m: number; s: number; minOfDay: number };

function parseClock(raw?: string | null): Clock | null {
    if (raw == null) return null;

    const v = String(raw)
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim();

    if (!v) return null;

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

    let best: { start: number; countIn: number; maxDiff: number } | null = null;

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

        if (!best) best = { start, countIn, maxDiff };
        else if (countIn > best.countIn) best = { start, countIn, maxDiff };
        else if (countIn === best.countIn && maxDiff < best.maxDiff) best = { start, countIn, maxDiff };
        else if (countIn === best.countIn && maxDiff === best.maxDiff && start < best.start) best = { start, countIn, maxDiff };
    }

    if (!best || best.countIn === 0) {
        const first = clocks.slice().sort((a, b) => a.minOfDay - b.minOfDay)[0];
        return first.h * 60;
    }

    return best.start;
}

function goalToGameSeconds(g: GoalDto, startMinOfDay: number | null, totalMinutes: number): number | null {
    const c = parseClock(g.time);
    if (!c || startMinOfDay == null) return null;

    const d = diffSecClock(c, startMinOfDay);
    return clamp(d, 0, totalMinutes * 60);
}

/** ===== timeline ===== */
type GoalEvent = GoalDto & {
    minute: number;
    tSec: number;
    team: 1 | 2 | 0;

    teamGoalNo: number;
    scoreAAfter: number;
    scoreBAfter: number;
};

type Props = {
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
}: Props) {
    const SIM_DURATION_MS = durationMs;

    const inferredStart = useMemo(() => inferStartMinOfDayFromGoals(goals ?? []), [goals]);

    const timeline = useMemo(() => {
        const base = (goals ?? [])
            .map((g) => {
                const tSec = goalToGameSeconds(g, inferredStart, totalMinutes) ?? totalMinutes * 60;
                const minute = clamp(Math.floor(tSec / 60), 0, totalMinutes);

                const teamRaw = teamByPlayerId.get(String(g.scorerPlayerId));
                const team = (teamRaw === 1 ? 1 : teamRaw === 2 ? 2 : 0) as 1 | 2 | 0;

                return { ...g, tSec, minute, team };
            })
            .sort((a, b) => a.tSec - b.tSec);

        let a = 0;
        let b = 0;

        return base.map((g) => {
            let teamGoalNo = 0;
            if (g.team === 1) {
                a += 1;
                teamGoalNo = a;
            } else if (g.team === 2) {
                b += 1;
                teamGoalNo = b;
            }

            return { ...g, teamGoalNo, scoreAAfter: a, scoreBAfter: b } as GoalEvent;
        });
    }, [goals, teamByPlayerId, totalMinutes, inferredStart]);

    const [running, setRunning] = useState<boolean>(!!autoPlay);
    const [elapsedMs, setElapsedMs] = useState<number>(0);

    const simSec = useMemo(() => {
        const p = SIM_DURATION_MS > 0 ? Math.min(1, elapsedMs / SIM_DURATION_MS) : 0;
        return p * (totalMinutes * 60);
    }, [elapsedMs, SIM_DURATION_MS, totalMinutes]);

    const simMinuteInt = clamp(Math.floor(simSec / 60), 0, totalMinutes);

    const scoreA = useMemo(() => timeline.filter((g) => g.tSec <= simSec && g.team === 1).length, [timeline, simSec]);
    const scoreB = useMemo(() => timeline.filter((g) => g.tSec <= simSec && g.team === 2).length, [timeline, simSec]);

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

    const tooltip = (g: GoalEvent) => {
        const mm = String(g.minute).padStart(2, "0");
        const teamLabel = g.team === 1 ? "Time A" : g.team === 2 ? "Time B" : "—";
        return {
            title: `⚽ ${g.scorerName}${g.teamGoalNo ? ` (#${g.teamGoalNo})` : ""}`,
            assist: g.assistName ? `🤝 Assist: ${g.assistName}` : null,
            minute: `${mm}'`,
            clock: g.time ?? "--:--",
            teamLabel,
            score: `${g.scoreAAfter} x ${g.scoreBAfter}`,
        };
    };

    /** ✅ fill branco PREMIUM (sempre visível) */
    const progressFillStyle = (colorHex: string): React.CSSProperties => {
        const c = normalizeHex(colorHex);
        const white = isWhiteHex(c);

        if (white) {
            return {
                left: 0,
                width: `${progressPct}%`,
                opacity: 1,
                backgroundColor: "rgba(148,163,184,.35)", // base visível
                backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(148,163,184,.55) 0 8px, rgba(255,255,255,.95) 8px 16px)",
                boxShadow: "inset 0 0 0 1px rgba(100,116,139,.35)",
                borderRadius: 9999,
            };
        }

        return {
            left: 0,
            width: `${progressPct}%`,
            backgroundColor: c,
            opacity: 0.25,
            borderRadius: 9999,
        };
    };

    /** ✅ glow branco usa slate */
    const glowStyle = (colorHex: string): React.CSSProperties => {
        const c = normalizeHex(colorHex);
        const white = isWhiteHex(c);
        return { backgroundColor: white ? "#94a3b8" : c, opacity: white ? 0.35 : 0.25 };
    };

    /** ✅ puck PREMIUM (anel duplo + ring) */
    const puckClass = (colorHex: string) => {
        const c = normalizeHex(colorHex);
        const white = isWhiteHex(c);

        // white: ring forte (pra não sumir no fundo branco)
        if (white) {
            return cls(
                "relative z-10 h-7 w-7 rounded-full grid place-items-center cursor-pointer",
                "bg-white border-2 border-slate-400",
                "ring-2 ring-slate-300/60",
                "shadow-[0_10px_22px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]",
                "transition-transform duration-200 group-hover:scale-110"
            );
        }

        return cls(
            "relative z-10 h-7 w-7 rounded-full grid place-items-center cursor-pointer",
            "bg-white border-2",
            "shadow-[0_10px_22px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.85)]",
            "transition-transform duration-200 group-hover:scale-110"
        );
    };

    const puckStyle = (colorHex: string): React.CSSProperties => {
        const c = normalizeHex(colorHex);
        const white = isWhiteHex(c);
        if (white) return {};
        return { borderColor: c };
    };

    const innerRingStyle = (colorHex: string): React.CSSProperties => {
        const c = normalizeHex(colorHex);
        const white = isWhiteHex(c);
        return {
            boxShadow: `inset 0 0 0 2px ${white ? "rgba(100,116,139,.35)" : `${c}55`}`,
        };
    };

    const renderBar = (teamLabel: string, team: 1 | 2, colorHex: string) => {
        const c = normalizeHex(colorHex);
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
                    {/* trilho */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-slate-100 border border-slate-200" />

                    {/* ✅ fill (agora com left:0 SEMPRE) */}
                    <div className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full" style={progressFillStyle(c)} />

                    {/* ticks */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1 pointer-events-none">
                        {Array.from({ length: 13 }).map((_, i) => (
                            <div key={i} className="h-5 w-px bg-slate-200" />
                        ))}
                    </div>

                    {teamGoals.map((g) => {
                        const leftPct = (g.tSec / (totalMinutes * 60)) * 100;
                        const isVisible = g.tSec <= simSec;
                        const t = tooltip(g);

                        return (
                            <div
                                key={g.goalId}
                                className={cls(
                                    "absolute top-1/2 -translate-y-1/2",
                                    "transition-all duration-300",
                                    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
                                )}
                                style={{ left: `calc(${leftPct}% - 12px)` }}
                            >
                                <div className="relative group">
                                    {/* glow */}
                                    <div
                                        className={cls("absolute -inset-1 rounded-full blur-[3px]", isVisible ? "animate-pulse" : "")}
                                        style={glowStyle(c)}
                                    />

                                    {/* puck */}
                                    <div className={puckClass(c)} style={puckStyle(c)}>
                                        <span className="absolute inset-[3px] rounded-full" style={innerRingStyle(c)} />
                                        <span className="relative text-sm">⚽</span>
                                    </div>

                                    {/* tooltip */}
                                    <div
                                        className="
                      absolute bottom-11 left-1/2 -translate-x-1/2
                      w-[290px]
                      rounded-2xl
                      bg-slate-900/95
                      text-white
                      shadow-2xl
                      border border-slate-700/80
                      p-4
                      opacity-0
                      scale-95
                      pointer-events-none
                      transition-all duration-200
                      group-hover:opacity-100
                      group-hover:scale-100
                      z-50
                      backdrop-blur
                    "
                                    >
                                        <div
                                            className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-4 w-4 rotate-45 bg-slate-900/95 border-r border-b border-slate-700/80"
                                            aria-hidden
                                        />
                                        <div className="text-[13px] font-semibold text-emerald-300">{t.title}</div>
                                        {t.assist ? <div className="mt-1 text-slate-200 text-[12px]">{t.assist}</div> : null}

                                        <div className="mt-3 grid grid-cols-2 gap-y-1 text-[12px]">
                                            <div className="text-slate-400">Minuto</div>
                                            <div className="text-right font-medium text-white">{t.minute}</div>

                                            <div className="text-slate-400">Relógio</div>
                                            <div className="text-right font-medium text-white">{t.clock}</div>

                                            <div className="text-slate-400">{t.teamLabel}</div>
                                            <div className="text-right font-semibold text-white">{t.score}</div>
                                        </div>
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
    const endLabel = inferredStart == null ? "--:--" : toHHMM(inferredStart + totalMinutes);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-semibold text-slate-900">Simulação do jogo</div>
                    <div className="text-xs text-slate-500">
                        {totalMinutes} minutos em <b>{Math.round(SIM_DURATION_MS / 1000)}s</b> • jogo inferido:{" "}
                        <b>{startLabel}</b> → <b>{endLabel}</b>
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