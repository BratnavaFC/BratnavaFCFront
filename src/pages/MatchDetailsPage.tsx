import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";

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

export default function MatchDetailsPage() {
    const { matchId } = useParams();
    const store = useAccountStore();
    const active = store.getActive();
    const groupId = active?.activeGroupId;

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

    if (!groupId) {
        return (
            <div className="space-y-6">
                <Section title="Detalhes da partida">
                    <div className="text-sm text-slate-500">Selecione um Group no Dashboard.</div>
                </Section>
            </div>
        );
    }

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
            {/* HEADER / PLACAR */}
            <Section title="Placar">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <div className="text-sm text-slate-500">{data.groupName}</div>
                            <div className="text-lg font-semibold text-slate-900">{data.placeName}</div>
                            <div className="text-xs text-slate-500">{data.playedAt ? formatDate(data.playedAt) : "-"}</div>
                        </div>

                        <div className="text-center">
                            <div className="text-4xl font-bold text-slate-900">
                                {data.teamAGoals ?? "-"} <span className="text-slate-400">x</span> {data.teamBGoals ?? "-"}
                            </div>
                            <div className="text-sm text-slate-500">
                                {data.statusName} <span className="text-slate-300">•</span> {data.status}
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 text-right max-w-[280px]">
                            <div className="font-medium text-slate-700">MatchId</div>
                            <div className="break-all">{data.matchId}</div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* INFORMAÇÕES GERAIS */}
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
                            {data.teamAColor?.hexValue && (
                                <span className="inline-block w-4 h-4 rounded border border-slate-200" style={{ background: data.teamAColor.hexValue }} />
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-slate-700 mt-2">
                            <b>Cor Time B:</b>
                            <span className="text-slate-600">{data.teamBColor?.name ?? "-"}</span>
                            {data.teamBColor?.hexValue && (
                                <span className="inline-block w-4 h-4 rounded border border-slate-200" style={{ background: data.teamBColor.hexValue }} />
                            )}
                        </div>
                    </div>
                </div>
            </Section>

            {/* TIMES */}
            <Section title="Escalação">
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold text-slate-900 mb-3">
                            Time A <span className="text-slate-400 font-normal">({teamAPlayers.length})</span>
                        </div>

                        <ul className="space-y-2 text-sm">
                            {teamAPlayers.map((p: any) => (
                                <li key={p.matchPlayerId ?? p.playerId} className="flex items-center justify-between gap-3">
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
                        <div className="font-semibold text-slate-900 mb-3">
                            Time B <span className="text-slate-400 font-normal">({teamBPlayers.length})</span>
                        </div>

                        <ul className="space-y-2 text-sm">
                            {teamBPlayers.map((p: any) => (
                                <li key={p.matchPlayerId ?? p.playerId} className="flex items-center justify-between gap-3">
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

            {/* GOLS + ABAS */}
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
                                    <div
                                        key={g.goalId}
                                        className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"
                                    >
                                        <div className="text-slate-800">
                                            <span className="mr-2" aria-hidden>⚽</span>
                                            <span className="font-medium">{g.scorerName ?? "-"}</span>
                                            {g.assistName ? (
                                                <span className="text-slate-600">
                                                    {" "}
                                                    <span className="mx-1" aria-hidden>🤝</span>
                                                    {g.assistName}
                                                </span>
                                            ) : null}
                                            {g.time ? <span className="text-slate-500"> — {g.time}</span> : null}
                                            {g.team && g.team !== "?" ? (
                                                <span className="ml-2 text-xs text-slate-400">({g.team === "A" ? "A" : "B"})</span>
                                            ) : null}
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
                                    <div
                                        key={t.goalId}
                                        className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"
                                    >
                                        <div className="text-slate-800">
                                            <span className="text-slate-400 mr-2">#{t.idx}</span>
                                            <span className="mr-2" aria-hidden>⚽</span>
                                            <span className="font-medium">{t.scorerName ?? "-"}</span>
                                            {t.assistName ? (
                                                <span className="text-slate-600">
                                                    {" "}
                                                    <span className="mx-1" aria-hidden>🤝</span>
                                                    {t.assistName}
                                                </span>
                                            ) : null}
                                            {t.time ? <span className="text-slate-500"> — {t.time}</span> : null}
                                        </div>

                                        <div className="text-right">
                                            <div className="font-semibold text-slate-900">
                                                {t.scoreA} <span className="text-slate-400">x</span> {t.scoreB}
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

            {/* VOTOS */}
            <Section title="Votação">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div><b>computedMvp:</b> {data.computedMvp ?? "null"}</div>
                    <div className="mt-1"><b>votes:</b> {data.votes?.length ?? 0}</div>
                    <div className="mt-1"><b>voteCounts:</b> {data.voteCounts?.length ?? 0}</div>
                </div>
            </Section>
        </div>
    );
}