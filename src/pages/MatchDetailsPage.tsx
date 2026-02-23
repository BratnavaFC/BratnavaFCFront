import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";

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

/** ✅ Contorno MAIS FINO possível, mas SÓ quando a cor do time for branca */
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

/** ✅ Swatch com borda + fundo “checker” (branco não some) */
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
                active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    );
}

/**
 * ✅ 2 barrinhas (A em cima, B em baixo)
 * - Cada barrinha tem uma bola (⚽) que “anda” somente quando o time faz gol
 * - A ordem é cronológica dos gols
 * - Duração total: 4s
 * - No fim: a bola vira o número final de gols daquele time
 * - Replay para rodar novamente
 */
function ScoreProgressAnimationStacked({
    goals,
    teamAHex,
    teamBHex,
    finalA,
    finalB,
}: {
    goals: Array<{ team: GoalTeam }>;
    teamAHex?: string;
    teamBHex?: string;
    finalA: number;
    finalB: number;
}) {
    const seq = useMemo(() => goals.filter((g) => g.team === "A" || g.team === "B"), [goals]);
    const totalGoals = seq.length;
    const segments = Math.max(totalGoals, 1);

    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [stepA, setStepA] = useState(0);
    const [stepB, setStepB] = useState(0);

    const timersRef = useRef<number[]>([]);

    const clearTimers = () => {
        for (const t of timersRef.current) window.clearTimeout(t);
        timersRef.current = [];
    };

    const start = () => {
        clearTimers();
        setIsDone(false);
        setIsRunning(true);
        setStepA(0);
        setStepB(0);

        if (totalGoals === 0) {
            const t = window.setTimeout(() => {
                setIsDone(true);
                setIsRunning(false);
            }, 150);
            timersRef.current.push(t);
            return;
        }

        const stepMs = 8000 / totalGoals;

        let a = 0;
        let b = 0;

        seq.forEach((g, idx) => {
            const t = window.setTimeout(() => {
                if (g.team === "A") {
                    a += 1;
                    setStepA(a);
                } else if (g.team === "B") {
                    b += 1;
                    setStepB(b);
                }
            }, Math.round((idx + 1) * stepMs));
            timersRef.current.push(t);
        });

        const endT = window.setTimeout(() => {
            setIsDone(true);
            setIsRunning(false);
        }, 8100);
        timersRef.current.push(endT);
    };

    useEffect(() => {
        start();
        return () => clearTimers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalGoals]);

    const aColor = safeHex(teamAHex) || "#0f172a";
    const bColor = safeHex(teamBHex) || "#0f172a";

    const posA = `${(stepA / segments) * 100}%`;
    const posB = `${(stepB / segments) * 100}%`;

    const ballBase =
        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 rounded-full shadow-sm border flex items-center justify-center text-sm font-bold select-none bg-white";

    const trackBase = "relative h-12";
    const trackLine =
        "absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-slate-100 border border-slate-200";

    const markers = (
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3">
            {Array.from({ length: segments + 1 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-px h-5 bg-slate-200"
                    style={{ left: `${(i / segments) * 100}%` }}
                />
            ))}
        </div>
    );

    const renderTrack = (team: "A" | "B") => {
        const isA = team === "A";
        const color = isA ? aColor : bColor;
        const left = isA ? posA : posB;
        const doneValue = isA ? finalA : finalB;

        return (
            <div className={trackBase}>
                <div className={trackLine} />
                {markers}
                <div className={cn(ballBase, "transition-[left] duration-300 ease-out")} style={{ left, borderColor: color }}>
                    {isDone ? doneValue : "⚽"}
                </div>
            </div>
        );
    };

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">{isRunning ? "Reproduzindo (4s)..." : isDone ? "Fim da animação" : "—"}</div>
                <button
                    type="button"
                    onClick={start}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                    Replay
                </button>
            </div>

            <div className="mt-3 space-y-3">
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs font-semibold" style={teamTextStyle(aColor)}>
                            Time A
                        </div>
                        <div className="text-xs text-slate-500">
                            {stepA}/{finalA}
                        </div>
                    </div>
                    {renderTrack("A")}
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs font-semibold" style={teamTextStyle(bColor)}>
                            Time B
                        </div>
                        <div className="text-xs text-slate-500">
                            {stepB}/{finalB}
                        </div>
                    </div>
                    {renderTrack("B")}
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <ColorSwatch color={aColor} size={14} title={`Time A ${aColor}`} />
                    <span>Cor Time A</span>
                </div>
                <div className="flex items-center gap-2">
                    <ColorSwatch color={bColor} size={14} title={`Time B ${bColor}`} />
                    <span>Cor Time B</span>
                </div>
            </div>
        </div>
    );
}

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

    const sortedGoals = useMemo(() => {
        const goals = [...(data?.goals ?? [])].sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0));
        return goals.map((g) => {
            const teamFromMatchPlayerId =
                g?.scorerMatchPlayerId && teamIndex.byMatchPlayerId.get(g.scorerMatchPlayerId);
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

    const finalA = Number(data?.teamAGoals ?? 0);
    const finalB = Number(data?.teamBGoals ?? 0);

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

                            <ScoreProgressAnimationStacked
                                goals={sortedGoals}
                                teamAHex={data.teamAColor?.hexValue}
                                teamBHex={data.teamBColor?.hexValue}
                                finalA={finalA}
                                finalB={finalB}
                            />
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
                                                <span style={teamTextStyle(aColor)}>{t.scoreA}</span>{" "}
                                                <span className="text-slate-400">x</span>{" "}
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
                            ? `${data.computedMvp.playerName}${data.computedMvp.team
                                ? ` (Time ${data.computedMvp.team === 1 ? "A" : data.computedMvp.team === 2 ? "B" : "?"})`
                                : ""
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