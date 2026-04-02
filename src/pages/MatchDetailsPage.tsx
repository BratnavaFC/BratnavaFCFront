import { CSSProperties, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";
import {
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    MapPin,
    Pause,
    Pencil,
    Play,
    RefreshCw,
} from "lucide-react";
import { getResponseMessage } from "../api/apiResponse";
import useAccountStore from "../auth/accountStore";
import { isGodMode } from "../auth/guards";
import { useGroupIcons, useShowPlayerStats } from "../hooks/useGroupIcons";
import { IconRenderer } from "../components/IconRenderer";
import { resolveIcon } from "../lib/groupIcons";
import { MvpResultCard } from "../domains/matches/ui/MvpResultCard";
import CssText from "../components/CssText";
import MaskedName from "../components/MaskedName";

/* ===================== helpers ===================== */

function formatMatchDate(date: string) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
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

function teamTextStyle(color: string): CSSProperties {
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
            className={cn(
                "relative inline-block rounded border border-slate-300 dark:border-slate-600 overflow-hidden shadow-sm shrink-0",
                className
            )}
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
                style={{ background: hex ?? "transparent", opacity: hex ? 1 : 0 }}
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
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition whitespace-nowrap",
                active
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
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

        if (!best) { best = cand; continue; }
        if (cand.countIn > best.countIn) { best = cand; continue; }
        if (cand.countIn === best.countIn && cand.maxDiff < best.maxDiff) { best = cand; continue; }
        if (cand.countIn === best.countIn && cand.maxDiff === best.maxDiff && cand.firstDiff < best.firstDiff) { best = cand; continue; }
        if (cand.countIn === best.countIn && cand.maxDiff === best.maxDiff && cand.firstDiff === best.firstDiff && cand.start < best.start) { best = cand; continue; }
    }

    if (!best || best.countIn === 0) return first.h * 60;
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
    teamAName?: string;
    teamBName?: string;
    totalMinutes?: number;
    durationMs?: number;
    autoPlay?: boolean;
};

export function MatchTimeSimulationTimeline({
    goals,
    teamByPlayerId,
    teamAHex = "#1d4ed8",
    teamBHex = "#f97316",
    teamAName = "Time A",
    teamBName = "Time B",
    totalMinutes = 60,
    durationMs = 15000,
    autoPlay = true,
}: SimulationProps) {
    const SIM_DURATION_MS = durationMs;

    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

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
            if (clamped >= SIM_DURATION_MS) { setRunning(false); return; }
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

    const SimBtn = ({
        children,
        title,
        onClick,
        disabled,
    }: {
        children: React.ReactNode;
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
                "inline-flex items-center justify-center h-8 w-8 rounded-lg border text-sm transition",
                disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            )}
        >
            {children}
        </button>
    );

    const renderBar = (teamLabel: string, team: 1 | 2, colorHex: string) => {
        const teamGoals = timeline.filter((g) => g.team === team);
        const totalTeamGoals = teamGoals.length;
        const currentTeamGoals = team === 1 ? scoreA : scoreB;

        // Per-goal horizontal offset so same-tSec goals sit side-by-side
        const seenTSec = new Map<number, number>();
        const offsetByGoalId = new Map<string, number>();
        for (const g of teamGoals) {
            const idx = seenTSec.get(g.tSec) ?? 0;
            offsetByGoalId.set(g.goalId, idx);
            seenTSec.set(g.tSec, idx + 1);
        }

        const isWhiteColor = isWhiteHex(colorHex);
        // White teams get a visible slate border so the dot isn't invisible on white BG
        const safeBorderColor = isWhiteColor ? "#94a3b8" : colorHex;
        // Score label colour: white teams use slate so it reads against the white card
        const safeLabelColor = isWhiteColor ? "#334155" : colorHex;

        return (
            <div>
                {/* Label row */}
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-block h-3 w-3 rounded-full shrink-0"
                            style={{
                                backgroundColor: colorHex,
                                border: `2px solid ${safeBorderColor}`,
                                boxShadow: isWhiteColor
                                    ? "inset 0 0 0 1px rgba(148,163,184,0.6)"
                                    : undefined,
                            }}
                        />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                            {teamLabel}
                        </span>
                    </div>
                    <span className="text-xs tabular-nums font-semibold shrink-0">
                        <span style={{ color: safeLabelColor }}>{currentTeamGoals}</span>
                        <span className="text-slate-300 dark:text-slate-600 font-normal"> / {totalTeamGoals}</span>
                    </span>
                </div>

                {/* Timeline track */}
                <div className="relative h-12">
                    {/* Background rail */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />

                    {/* Progress fill — no CSS transition: rAF drives this at 60fps */}
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-l-full"
                        style={{
                            width: `${progressPct}%`,
                            backgroundColor: isWhiteColor ? "#94a3b8" : colorHex,
                            opacity: 0.55,
                        }}
                    />

                    {/* Current-time cursor (thin vertical line) — no CSS transition */}
                    <div
                        className="absolute top-0.5 bottom-0.5 w-px rounded-full bg-slate-400/60"
                        style={{ left: `${progressPct}%` }}
                    />

                    {/* Minute tick marks (every ~10 min out of 60) */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                        ))}
                    </div>

                    {/* Goal markers */}
                    {teamGoals.map((g) => {
                        const leftPct = (g.tSec / (totalMinutes * 60)) * 100;
                        const offsetIdx = offsetByGoalId.get(g.goalId) ?? 0;
                        const isVisible = g.tSec <= simSec;
                        return (
                            <div
                                key={g.goalId}
                                className={cls(
                                    "absolute top-1/2 -translate-y-1/2 transition-all duration-300",
                                    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
                                )}
                                style={{ left: `calc(${leftPct}% - 12px + ${offsetIdx * 26}px)` }}
                            >
                                {/* Glow ring — only when visible */}
                                {isVisible && (
                                    <div
                                        className="absolute -inset-2 rounded-full blur-sm opacity-30 animate-pulse"
                                        style={{ backgroundColor: colorHex }}
                                    />
                                )}
                                {/* Ball icon */}
                                <div
                                    className="relative h-7 w-7 rounded-full grid place-items-center text-[15px] border-2 bg-white shadow-md"
                                    style={{
                                        borderColor: safeBorderColor,
                                        boxShadow: isVisible
                                            ? `0 0 0 2px ${colorHex}22, 0 2px 8px rgba(0,0,0,0.14)`
                                            : undefined,
                                    }}
                                >
                                    <IconRenderer value={resolveIcon(_icons, 'goal')} size={16} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">

            {/* ── Controls bar ────────────────────────────────────── */}
            <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums shrink-0 w-14">
                    {simMinuteInt}'
                    <span className="text-slate-400 dark:text-slate-500 font-normal">/{totalMinutes}</span>
                </span>

                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <SimBtn onClick={resetAndPlay} title="Reiniciar">
                        <RefreshCw size={12} />
                    </SimBtn>
                    <SimBtn
                        onClick={() => {
                            if (elapsedMs >= SIM_DURATION_MS) setElapsedMs(0);
                            setRunning(true);
                        }}
                        title="Play"
                        disabled={running}
                    >
                        <Play size={12} />
                    </SimBtn>
                    <SimBtn onClick={() => setRunning(false)} title="Pausa" disabled={!running}>
                        <Pause size={12} />
                    </SimBtn>
                </div>
            </div>

            {/* ── Timeline bars ────────────────────────────────────── */}
            <div className="px-5 py-5 space-y-5">
                {renderBar(teamAName, 1, teamAHex)}
                {renderBar(teamBName, 2, teamBHex)}
            </div>
        </div>
    );
}

/* ===================== page ===================== */

export default function MatchDetailsPage() {
    const nav = useNavigate();
    const { groupId, matchId } = useParams<{ groupId: string; matchId: string }>();
    const _icons = useGroupIcons(groupId);

    const [data, setData] = useState<any>(null);
    const [goalsTab, setGoalsTab] = useState<"gols" | "teamA" | "teamB" | "timeline">("gols");

    const active = useAccountStore((s) => s.getActive());
    const isGod = isGodMode();
    const isGroupAdm = !!groupId && (active?.groupAdminIds?.includes(groupId) ?? false);
    const canSeeMvp = isGroupAdm || isGod;
    const isAdmin = isGroupAdm || isGod;
    const showStats   = useShowPlayerStats(groupId);
    const canSeeGoals = isAdmin || showStats;

    // ── Edit goal state ───────────────────────────────────────────────────────
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [editScorerId, setEditScorerId] = useState<string>("");
    const [editAssistId, setEditAssistId] = useState<string | null>(null);
    const [editTime, setEditTime] = useState<string>("");
    const [editIsOwnGoal, setEditIsOwnGoal] = useState<boolean>(false);
    const [savingGoal, setSavingGoal] = useState<boolean>(false);

    useEffect(() => {
        (async () => {
            if (!groupId || !matchId) return;
            try {
                const res = await MatchesApi.details(groupId, matchId);
                setData(res.data.data as any);
            } catch (e) {
                toast.error(getResponseMessage(e, "Falha ao carregar detalhes da partida."));
            }
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

    const sortedGoals = useMemo(() => {
        const goals = [...(data?.goals ?? [])].sort((a, b) => {
            const ca = parseClock(a?.time);
            const cb = parseClock(b?.time);
            const va = ca ? ca.minOfDay * 60 + ca.s : Number.POSITIVE_INFINITY;
            const vb = cb ? cb.minOfDay * 60 + cb.s : Number.POSITIVE_INFINITY;
            return va - vb;
        });
        return goals.map((g) => {
            const teamFromMatchPlayerId =
                g?.scorerMatchPlayerId && teamIndex.byMatchPlayerId.get(g.scorerMatchPlayerId);
            const teamFromPlayerId =
                g?.scorerPlayerId && teamIndex.byPlayerId.get(g.scorerPlayerId);
            const scorerTeam: GoalTeam = (teamFromMatchPlayerId ?? teamFromPlayerId ?? "?") as GoalTeam;
            // Gol contra: o ponto vai para o time adversário do marcador
            const team: GoalTeam = g?.isOwnGoal
                ? (scorerTeam === "A" ? "B" : scorerTeam === "B" ? "A" : "?")
                : scorerTeam;
            return { ...g, team };
        });
    }, [data, teamIndex]);

    // Must be declared BEFORE timelineGoals useMemo to avoid TDZ in the closure
    const aColor = safeHex(data?.teamAColor?.hexValue) || "#0f172a";
    const bColor = safeHex(data?.teamBColor?.hexValue) || "#0f172a";
    const aName = data?.teamAColor?.name ?? "Time A";
    const bName = data?.teamBColor?.name ?? "Time B";
    const aNameRef = aName;
    const bNameRef = bName;

    const timelineGoals = useMemo(() => {
        let a = 0;
        let b = 0;
        return sortedGoals.map((g: any, idx: number) => {
            if (g.team === "A") a += 1;
            else if (g.team === "B") b += 1;
            const leader =
                a === b ? "Empate" : a > b ? `${aNameRef} na frente` : `${bNameRef} na frente`;
            return {
                idx: idx + 1,
                goalId: g.goalId,
                time: g.time,
                scorerName: g.scorerName,
                assistName: g.assistName,
                isOwnGoal: g.isOwnGoal,
                team: g.team as GoalTeam,
                scoreA: a,
                scoreB: b,
                leader,
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortedGoals]);

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (!data) {
        return (
            <div className="space-y-4">
                <div className="h-8 w-36 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-56 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
                <div className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
        );
    }

    const scoreA = data.teamAGoals ?? "–";
    const scoreB = data.teamBGoals ?? "–";
    const mvps: any[] = (data as any).computedMvps ?? []; // baseado em votos — visível só para admin/god
    const voteCounts: any[] = [...(data.voteCounts ?? [])].sort(
        (a, b) => (b.count ?? 0) - (a.count ?? 0)
    );
    const maxVotes = voteCounts.length > 0 ? (voteCounts[0].count ?? 0) : 0;

    // MVP baseado na flag isMvp (camelCase do backend) — visível para todos
    const mvpPlayers = [...(teamAPlayers as any[]), ...(teamBPlayers as any[])].filter((p) => p.isMvp);
    const mvpPlayer = mvpPlayers[0]; // primeiro MVP (para compatibilidade de teamName)
    const mvpPlayerTeamName = mvpPlayer ? (mvpPlayer.team === 1 ? aName : mvpPlayer.team === 2 ? bName : "") : "";

    // Team-colored dot for goal rows
    const GoalDot = ({ team }: { team: GoalTeam }) => {
        const color = team === "A" ? aColor : team === "B" ? bColor : "#94a3b8";
        return (
            <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
            />
        );
    };

    // ── Edit goal helpers ─────────────────────────────────────────────────────
    function incrementEditTime(current: string, delta: number): string {
        const parts = current.split(":");
        let h = parseInt(parts[0] ?? "0", 10);
        let m = parseInt(parts[1] ?? "0", 10);
        if (isNaN(h)) h = 0;
        if (isNaN(m)) m = 0;
        const total = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
        return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    function openEditGoal(g: any) {
        setEditingGoalId(g.goalId);
        setEditScorerId(g.scorerPlayerId ?? "");
        setEditAssistId(g.assistPlayerId ?? null);
        setEditTime(g.time ?? "");
        setEditIsOwnGoal(g.isOwnGoal ?? false);
    }

    function closeEditGoal() {
        setEditingGoalId(null);
        setEditScorerId("");
        setEditAssistId(null);
        setEditTime("");
        setEditIsOwnGoal(false);
    }

    async function saveEditGoal() {
        if (!editingGoalId || !editScorerId || !groupId || !matchId) return;
        setSavingGoal(true);
        try {
            const updateRes = await MatchesApi.updateGoal(groupId, matchId, editingGoalId, {
                scorerPlayerId: editScorerId,
                assistPlayerId: editAssistId,
                time: editTime || null,
                isOwnGoal: editIsOwnGoal,
            });
            const res = await MatchesApi.details(groupId, matchId);
            setData(res.data.data as any);
            closeEditGoal();
            if (updateRes.data.message) toast.success(updateRes.data.message);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao atualizar o gol."));
        } finally {
            setSavingGoal(false);
        }
    }

    return (
        <div className="space-y-4 sm:space-y-6">

            {/* ── Back button ──────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => nav(-1)}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
                <ChevronLeft size={16} />
                Voltar ao histórico
            </button>

            {/* ── Hero / Placar ─────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg">
                {/* Top color strips */}
                <div className="flex h-1.5">
                    <div className="flex-1" style={{ backgroundColor: aColor }} />
                    <div className="flex-1" style={{ backgroundColor: bColor }} />
                </div>

                <div className="bg-slate-900 px-6 py-8 text-center">
                    {/* Team names */}
                    <div className="flex items-center justify-between gap-4 mb-5">
                        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                            <ColorSwatch color={aColor} size={22} />
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">
                                {aName}
                            </span>
                        </div>

                        <span className="text-slate-600 dark:text-slate-400 text-base font-light shrink-0">vs</span>

                        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                            <ColorSwatch color={bColor} size={22} />
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">
                                {bName}
                            </span>
                        </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center justify-center gap-4">
                        <span className="text-6xl sm:text-7xl font-extrabold text-white tabular-nums leading-none">
                            {scoreA}
                        </span>
                        <span className="text-3xl text-slate-600 dark:text-slate-400 font-light">×</span>
                        <span className="text-6xl sm:text-7xl font-extrabold text-white tabular-nums leading-none">
                            {scoreB}
                        </span>
                    </div>

                    {/* Match info */}
                    <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3 flex-wrap text-sm text-slate-400 dark:text-slate-500">
                        {data.placeName && (
                            <span className="flex items-center gap-1.5">
                                <MapPin size={13} className="shrink-0" />
                                {data.placeName}
                            </span>
                        )}
                        {data.placeName && data.playedAt && (
                            <span className="text-slate-700 dark:text-slate-500">·</span>
                        )}
                        {data.playedAt && (
                            <span className="flex items-center gap-1.5">
                                <Calendar size={13} className="shrink-0" />
                                {formatMatchDate(data.playedAt)}
                            </span>
                        )}
                        {(data.statusName || data.status) && (
                            <>
                                <span className="text-slate-700 dark:text-slate-500">·</span>
                                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70 border border-white/10">
                                    {data.statusName ?? data.status}
                                </span>
                            </>
                        )}
                    </div>

                    {/* MVP inline no hero */}
                    {(() => {
                        // Admin/god veem o MVP por votos; demais pelo isMvp
                        const heroMvpNames = canSeeMvp
                            ? (mvps.length > 0 ? mvps.map((m: any) => m.playerName) : mvpPlayers.map((p: any) => p.playerName))
                            : mvpPlayers.map((p: any) => p.playerName);
                        if (heroMvpNames.length === 0) return null;
                        const heroMvpName = heroMvpNames.join(" & ");
                        const isTie = heroMvpNames.length > 1;
                        return (
                            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-400/10 border border-amber-400/20 px-4 py-2.5">
                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={15} lucideProps={{ className: "text-amber-400 shrink-0" }} />
                                <span className="text-sm font-semibold text-amber-300">
                                    {isTie ? "MVPs" : "MVP"}: {heroMvpName}
                                </span>
                            </div>
                        );
                    })()}
                </div>

                {/* Bottom color strips */}
                <div className="flex h-1.5">
                    <div className="flex-1" style={{ backgroundColor: aColor }} />
                    <div className="flex-1" style={{ backgroundColor: bColor }} />
                </div>
            </div>

            {/* ── Simulação ─────────────────────────────────────────── */}
            <Section title="Simulação">
                <MatchTimeSimulationTimeline
                    goals={(data?.goals ?? []) as GoalDto[]}
                    teamByPlayerId={teamByPlayerIdNum}
                    teamAHex={aColor}
                    teamBHex={bColor}
                    teamAName={aName}
                    teamBName={bName}
                    totalMinutes={60}
                    durationMs={10000}
                    autoPlay
                />
            </Section>

            {/* ── Escalação ─────────────────────────────────────────── */}
            <Section title="Escalação">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Team A */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <ColorSwatch color={aColor} size={14} />
                            <span className="font-semibold text-sm" style={teamTextStyle(aColor)}>
                                {aName}
                            </span>
                            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                                {teamAPlayers.length} jog.
                            </span>
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {teamAPlayers.length === 0 ? (
                                <li className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">Nenhum jogador.</li>
                            ) : (
                                teamAPlayers.map((p: any) => (
                                    <li
                                        key={p.matchPlayerId}
                                        className="flex items-center gap-2.5 px-4 py-2.5 border-l-[3px]"
                                        style={{ borderLeftColor: aColor }}
                                    >
                                        {p.isGoalkeeper && (
                                            <span title="Goleiro" className="text-base leading-none shrink-0">
                                                <IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={15} />
                                            </span>
                                        )}
                                        <span className="text-sm text-slate-800 dark:text-slate-100 truncate flex-1">
                                            {p.playerName}
                                        </span>
                                        {p.isMvp && (
                                            <span title="MVP" className="shrink-0">
                                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={13} lucideProps={{ className: "text-amber-400" }} />
                                            </span>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>

                    {/* Team B */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <ColorSwatch color={bColor} size={14} />
                            <span className="font-semibold text-sm" style={teamTextStyle(bColor)}>
                                {bName}
                            </span>
                            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                                {teamBPlayers.length} jog.
                            </span>
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {teamBPlayers.length === 0 ? (
                                <li className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">Nenhum jogador.</li>
                            ) : (
                                teamBPlayers.map((p: any) => (
                                    <li
                                        key={p.matchPlayerId}
                                        className="flex items-center gap-2.5 px-4 py-2.5 border-l-[3px]"
                                        style={{ borderLeftColor: bColor }}
                                    >
                                        {p.isGoalkeeper && (
                                            <span title="Goleiro" className="text-base leading-none shrink-0">
                                                <IconRenderer value={resolveIcon(_icons, 'goalkeeper')} size={15} />
                                            </span>
                                        )}
                                        <span className="text-sm text-slate-800 dark:text-slate-100 truncate flex-1">
                                            {p.playerName}
                                        </span>
                                        {p.isMvp && (
                                            <span title="MVP" className="shrink-0">
                                                <IconRenderer value={resolveIcon(_icons, 'mvp')} size={13} lucideProps={{ className: "text-amber-400" }} />
                                            </span>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            </Section>

            {/* ── Gols ──────────────────────────────────────────────── */}
            {canSeeGoals && (
            <Section title={`Gols (${sortedGoals.length})`}>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                        <TabButton active={goalsTab === "gols"} onClick={() => setGoalsTab("gols")}>
                            Todos
                        </TabButton>
                        <TabButton active={goalsTab === "teamA"} onClick={() => setGoalsTab("teamA")}>
                            <span className="flex items-center gap-1.5">
                                <GoalDot team="A" />
                                {aName}
                            </span>
                        </TabButton>
                        <TabButton active={goalsTab === "teamB"} onClick={() => setGoalsTab("teamB")}>
                            <span className="flex items-center gap-1.5">
                                <GoalDot team="B" />
                                {bName}
                            </span>
                        </TabButton>
                        <TabButton
                            active={goalsTab === "timeline"}
                            onClick={() => setGoalsTab("timeline")}
                        >
                            Linha do tempo
                        </TabButton>
                    </div>

                    {/* Edit panel — shown above tabs when admin is editing */}
                    {isAdmin && editingGoalId && (() => {
                        const allPlayers = [...(teamAPlayers as any[]), ...(teamBPlayers as any[])];
                        const editScorer = allPlayers.find((p) => p.playerId === editScorerId);
                        const editAssistCandidates = editScorer
                            ? allPlayers.filter((p) =>
                                  p.playerId !== editScorerId &&
                                  (editIsOwnGoal ? p.team !== editScorer.team : p.team === editScorer.team)
                              )
                            : [];
                        return (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 mb-4 space-y-3">
                                <div className="text-xs font-semibold text-blue-700 uppercase tracking-widest">
                                    Editando gol
                                </div>

                                {/* Time field */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Tempo:</span>
                                    <input
                                        className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm w-24 text-center tabular-nums bg-white dark:bg-slate-800 dark:text-white"
                                        value={editTime}
                                        onChange={(e) => setEditTime(e.target.value)}
                                        placeholder="21:04"
                                    />
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            type="button"
                                            className="flex items-center justify-center w-6 h-5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                                            onClick={() => setEditTime(incrementEditTime(editTime, 1))}
                                            title="+1 minuto"
                                        >
                                            <ChevronUp size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            className="flex items-center justify-center w-6 h-5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                                            onClick={() => setEditTime(incrementEditTime(editTime, -1))}
                                            title="-1 minuto"
                                        >
                                            <ChevronDown size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* Scorer selection — two columns */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-xs font-semibold text-blue-600 mb-1.5 uppercase tracking-widest">
                                            {aName}
                                        </div>
                                        <div className="space-y-1">
                                            {(teamAPlayers as any[]).map((p: any) => (
                                                <button
                                                    key={p.playerId}
                                                    type="button"
                                                    className={cls(
                                                        "w-full text-left rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                                                        editScorerId === p.playerId
                                                            ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                                                            : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                    )}
                                                    onClick={() => {
                                                        setEditScorerId(p.playerId);
                                                        setEditAssistId(null);
                                                        setEditIsOwnGoal(false);
                                                    }}
                                                >
                                                    <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}{p.playerName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-red-600 mb-1.5 uppercase tracking-widest">
                                            {bName}
                                        </div>
                                        <div className="space-y-1">
                                            {(teamBPlayers as any[]).map((p: any) => (
                                                <button
                                                    key={p.playerId}
                                                    type="button"
                                                    className={cls(
                                                        "w-full text-left rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                                                        editScorerId === p.playerId
                                                            ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                                                            : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                    )}
                                                    onClick={() => {
                                                        setEditScorerId(p.playerId);
                                                        setEditAssistId(null);
                                                        setEditIsOwnGoal(false);
                                                    }}
                                                >
                                                    <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}{p.playerName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Gol contra + assist (when scorer selected) */}
                                {editScorer && (
                                    <>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded accent-orange-500"
                                                checked={editIsOwnGoal}
                                                onChange={(e) => {
                                                    setEditIsOwnGoal(e.target.checked);
                                                    setEditAssistId(null);
                                                }}
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">Gol contra</span>
                                            {editIsOwnGoal && (
                                                <span className="text-xs text-orange-600 font-medium">
                                                    (ponto para o time adversário)
                                                </span>
                                            )}
                                        </label>

                                        {editAssistCandidates.length > 0 && (
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                                    {editIsOwnGoal ? "Quem forçou (opcional):" : "Assistência (opcional):"}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {editAssistCandidates.map((p: any) => (
                                                        <button
                                                            key={p.playerId}
                                                            type="button"
                                                            className={cls(
                                                                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                                                                editAssistId === p.playerId
                                                                    ? "border-emerald-400 bg-emerald-200 text-emerald-900"
                                                                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                            )}
                                                            onClick={() =>
                                                                setEditAssistId((prev) =>
                                                                    prev === p.playerId ? null : p.playerId
                                                                )
                                                            }
                                                        >
                                                            <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}{p.playerName}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        className="btn text-sm"
                                        onClick={closeEditGoal}
                                        disabled={savingGoal}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className={cls(
                                            "btn btn-primary text-sm",
                                            (!editScorerId || savingGoal) && "opacity-50 pointer-events-none"
                                        )}
                                        disabled={!editScorerId || savingGoal}
                                        onClick={saveEditGoal}
                                    >
                                        {savingGoal ? "Salvando..." : "Salvar alterações"}
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Reusable goal card renderer */}
                    {(() => {
                        const goalCard = (g: any) => (
                            <div
                                key={g.goalId}
                                className={cls(
                                    "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                                    editingGoalId === g.goalId
                                        ? "border-blue-300 bg-blue-50"
                                        : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                                )}
                            >
                                <GoalDot team={g.team} />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                        <IconRenderer value={resolveIcon(_icons, 'goal')} size={14} />{" "}
                                        <CssText value={g.scorerName ?? "—"} />
                                        {g.isOwnGoal && (
                                            <span className="ml-1 text-xs font-normal text-orange-500">(C)</span>
                                        )}
                                    </div>
                                    {g.assistName && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            <IconRenderer value={resolveIcon(_icons, 'assist')} size={12} />{" "}
                                            <CssText value={g.assistName} />
                                        </div>
                                    )}
                                </div>
                                {g.time && (
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0">
                                        <CssText value={g.time} />
                                    </span>
                                )}
                                {isAdmin && (
                                    <button
                                        type="button"
                                        title={editingGoalId === g.goalId ? "Cancelar edição" : "Editar gol"}
                                        onClick={() =>
                                            editingGoalId === g.goalId ? closeEditGoal() : openEditGoal(g)
                                        }
                                        className={cls(
                                            "flex items-center justify-center w-7 h-7 rounded-lg border transition-colors shrink-0",
                                            editingGoalId === g.goalId
                                                ? "border-blue-300 bg-blue-100 text-blue-700"
                                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500"
                                        )}
                                    >
                                        <Pencil size={12} />
                                    </button>
                                )}
                            </div>
                        );

                        const emptyMsg = (msg: string) => (
                            <div className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">{msg}</div>
                        );

                        if (goalsTab === "gols") {
                            const list = sortedGoals as any[];
                            return (
                                <div className="space-y-2">
                                    {list.length === 0
                                        ? emptyMsg("Nenhum gol registrado.")
                                        : list.map(goalCard)}
                                </div>
                            );
                        }

                        if (goalsTab === "teamA") {
                            const list = (sortedGoals as any[]).filter((g) => g.team === "A");
                            return (
                                <div className="space-y-2">
                                    {list.length === 0
                                        ? emptyMsg(`${aName} não marcou gols.`)
                                        : list.map(goalCard)}
                                </div>
                            );
                        }

                        if (goalsTab === "teamB") {
                            const list = (sortedGoals as any[]).filter((g) => g.team === "B");
                            return (
                                <div className="space-y-2">
                                    {list.length === 0
                                        ? emptyMsg(`${bName} não marcou gols.`)
                                        : list.map(goalCard)}
                                </div>
                            );
                        }

                        // timeline
                        return (
                            <div className="space-y-2">
                                {(timelineGoals as any[]).length === 0 ? (
                                    emptyMsg("Nenhum gol registrado.")
                                ) : (
                                    (timelineGoals as any[]).map((t) => (
                                        <div
                                            key={t.goalId}
                                            className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
                                        >
                                            <GoalDot team={t.team} />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                    <span className="text-slate-400 dark:text-slate-500 text-xs mr-1">
                                                        #{t.idx}
                                                    </span>
                                                    <IconRenderer value={resolveIcon(_icons, 'goal')} size={14} />{" "}
                                                    <CssText value={t.scorerName ?? "—"} />
                                                    {t.isOwnGoal && (
                                                        <span className="ml-1 text-xs font-normal text-orange-500">(C)</span>
                                                    )}
                                                </div>
                                                {t.assistName && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        <IconRenderer value={resolveIcon(_icons, 'assist')} size={12} />{" "}
                                                        <CssText value={t.assistName} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-bold text-sm tabular-nums">
                                                    <span style={teamTextStyle(aColor)}>{t.scoreA}</span>
                                                    <span className="text-slate-400 dark:text-slate-500 mx-1">×</span>
                                                    <span style={teamTextStyle(bColor)}>{t.scoreB}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                                                    {t.leader}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        );
                    })()}
                </div>
            </Section>
            )}

            {/* ── MVP ───────────────────────────────────────────────── */}
            {(mvpPlayers.length > 0 || canSeeMvp) && (
                <Section title="MVP">
                    {(() => {
                        const cardNames = canSeeMvp
                            ? (mvps.length > 0 ? mvps.map((m: any) => m.playerName) : mvpPlayers.map((p: any) => p.playerName))
                            : mvpPlayers.map((p: any) => p.playerName);
                        return (
                            <MvpResultCard
                                mvpNames={cardNames.length > 0 ? cardNames : undefined}
                                voteCounts={canSeeMvp ? voteCounts : []}
                                votes={[]}
                                admin={canSeeMvp}
                                _icons={_icons}
                            />
                        );
                    })()}
                </Section>
            )}

        </div>
    );
}
