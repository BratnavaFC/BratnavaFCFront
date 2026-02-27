import type { GoalDto, PlayerInMatchDto, VoteCountDto } from "../matchTypes";
import { cls } from "../matchUtils";

export function StepPost({
    admin,
    currentMvpName,
    voteCounts,
    participants,
    onRefresh,
    onFinalize,

    // score
    scoreA,
    setScoreA,
    scoreB,
    setScoreB,
    settingScore,
    onSetScore,
    currentScoreA,
    currentScoreB,

    // vote
    voting,
    voteVoterMpId,
    setVoteVoterMpId,
    voteVotedMpId,
    setVoteVotedMpId,
    onVoteMvp,

    // goals
    goalScorerPlayerId,
    setGoalScorerPlayerId,
    goalAssistPlayerId,
    setGoalAssistPlayerId,
    goalTime,
    setGoalTime,
    addingGoal,
    onAddGoal,
    goals,
    removingGoal,
    onRemoveGoal,
}: {
    admin: boolean;
    currentMvpName: string;
    voteCounts: VoteCountDto[];
    participants: PlayerInMatchDto[];
    onRefresh: () => void;
    onFinalize: () => void;

    scoreA: string;
    setScoreA: (v: string) => void;
    scoreB: string;
    setScoreB: (v: string) => void;
    settingScore: boolean;
    onSetScore: () => void;
    currentScoreA: number | null | undefined;
    currentScoreB: number | null | undefined;

    voting: boolean;
    voteVoterMpId: string;
    setVoteVoterMpId: (v: string) => void;
    voteVotedMpId: string;
    setVoteVotedMpId: (v: string) => void;
    onVoteMvp: () => void;

    goalScorerPlayerId: string;
    setGoalScorerPlayerId: (v: string) => void;
    goalAssistPlayerId: string;
    setGoalAssistPlayerId: (v: string) => void;
    goalTime: string;
    setGoalTime: (v: string) => void;
    addingGoal: boolean;
    onAddGoal: () => void;
    goals: GoalDto[];
    removingGoal: Record<string, boolean>;
    onRemoveGoal: (goalId: string) => void;
}) {
    if (!admin) {
        const scoreText = currentScoreA == null || currentScoreB == null ? "—" : `${currentScoreA} x ${currentScoreB}`;

        return (
            <div className="card p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="font-semibold">Pós-jogo</div>
                        <div className="text-xs text-slate-500">Somente visualização (admin controla)</div>
                    </div>
                    <span className="pill">{currentMvpName || "MVP —"}</span>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold text-slate-900">Placar</div>
                        <div className="mt-2 text-3xl font-extrabold text-slate-900">{scoreText}</div>
                        <div className="text-xs text-slate-500 mt-1">Aguardando confirmação do admin, se necessário.</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold text-slate-900">MVP</div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{currentMvpName || "—"}</div>
                        <div className="text-xs text-slate-500 mt-1">Parciais: {voteCounts.length}</div>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">Gols</div>
                    <div className="text-xs text-slate-500">Visualização</div>

                    <div className="mt-3 grid gap-2">
                        {goals.length === 0 ? (
                            <div className="muted">Sem gols.</div>
                        ) : (
                            goals.map((g) => (
                                <div key={g.goalId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-900 truncate">
                                            ⚽ {g.scorerName}
                                            {g.assistName ? <span className="text-slate-500"> • 🤝 {g.assistName}</span> : null}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{g.time ?? "—"}</div>
                                    </div>
                                    <span className="pill">gol</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="font-semibold">Pós-jogo</div>
                        <div className="text-xs text-slate-500">Voto MVP • Placar • Gols • Finalizar</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="btn" onClick={onRefresh}>Recarregar</button>
                        <button className="btn btn-primary" onClick={onFinalize}>Finalizar</button>
                    </div>
                </div>

                {/* MVP */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">Votar MVP</div>
                    <div className="text-xs text-slate-500">Cada jogador vota 1 vez. Admin pode votar por qualquer um.</div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <label className="block">
                            <div className="label">Quem vota</div>
                            <select className="input h-9 text-sm" value={voteVoterMpId} onChange={(e) => setVoteVoterMpId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {participants.map((p) => (
                                    <option key={p.matchPlayerId} value={p.matchPlayerId}>
                                        {p.playerName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block md:col-span-2">
                            <div className="label">Votado</div>
                            <select className="input h-9 text-sm" value={voteVotedMpId} onChange={(e) => setVoteVotedMpId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {participants.map((p) => (
                                    <option key={p.matchPlayerId} value={p.matchPlayerId}>
                                        {p.playerName}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-xs text-slate-500">
                            MVP atual: <b>{currentMvpName?.trim() ? currentMvpName : "—"}</b>
                        </div>

                        <button
                            className={cls("btn btn-primary", (!voteVotedMpId || voting || !voteVoterMpId) && "opacity-50 pointer-events-none")}
                            disabled={!voteVotedMpId || voting || !voteVoterMpId}
                            onClick={onVoteMvp}
                        >
                            {voting ? "Votando..." : "Votar"}
                        </button>
                    </div>

                    <div className="mt-4">
                        <div className="text-sm font-semibold text-slate-900">Parciais</div>
                        <div className="mt-2 grid gap-2">
                            {voteCounts.length === 0 ? (
                                <div className="muted">Sem votos ainda.</div>
                            ) : (
                                voteCounts.map((v) => (
                                    <div key={v.votedForMatchPlayerId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="font-medium text-slate-900 truncate">{v.votedForName}</div>
                                        <span className="pill">{v.count}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* SCORE */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">Placar</div>
                    <div className="text-xs text-slate-500">Você pode setar manualmente (ou deixar pelos gols).</div>

                    <div className="grid grid-cols-2 gap-3 mt-3 max-w-[420px]">
                        <label className="block">
                            <div className="label">Time A</div>
                            <input className="input h-9 text-sm" value={scoreA} onChange={(e) => setScoreA(e.target.value)} placeholder="0" />
                        </label>
                        <label className="block">
                            <div className="label">Time B</div>
                            <input className="input h-9 text-sm" value={scoreB} onChange={(e) => setScoreB(e.target.value)} placeholder="0" />
                        </label>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-xs text-slate-500">
                            Atual: <b>{currentScoreA ?? "—"}</b> x <b>{currentScoreB ?? "—"}</b>
                        </div>

                        <button className={cls("btn btn-primary", settingScore && "opacity-50 pointer-events-none")} disabled={settingScore} onClick={onSetScore}>
                            {settingScore ? "Salvando..." : "Salvar placar"}
                        </button>
                    </div>
                </div>

                {/* GOALS */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">Gols</div>
                    <div className="text-xs text-slate-500">Adicionar/remover gols (recalcula o placar automaticamente).</div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <label className="block">
                            <div className="label">Autor</div>
                            <select className="input h-9 text-sm" value={goalScorerPlayerId} onChange={(e) => setGoalScorerPlayerId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {participants.map((p) => (
                                    <option key={p.playerId} value={p.playerId}>
                                        {p.playerName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <div className="label">Assistência (opcional)</div>
                            <select className="input h-9 text-sm" value={goalAssistPlayerId} onChange={(e) => setGoalAssistPlayerId(e.target.value)}>
                                <option value="">Sem assistência</option>
                                {participants.map((p) => (
                                    <option key={p.playerId} value={p.playerId}>
                                        {p.playerName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <div className="label">Tempo (ex: 21:04)</div>
                            <input className="input h-9 text-sm" value={goalTime} onChange={(e) => setGoalTime(e.target.value)} placeholder="21:04" />
                        </label>
                    </div>

                    <div className="mt-3 flex justify-end">
                        <button
                            className={cls("btn btn-primary", (!goalScorerPlayerId || !goalTime.trim() || addingGoal) && "opacity-50 pointer-events-none")}
                            disabled={!goalScorerPlayerId || !goalTime.trim() || addingGoal}
                            onClick={onAddGoal}
                        >
                            {addingGoal ? "Adicionando..." : "Adicionar gol"}
                        </button>
                    </div>

                    <div className="mt-4">
                        <div className="text-sm font-semibold text-slate-900">Lista de gols</div>
                        <div className="mt-2 grid gap-2">
                            {goals.length === 0 ? (
                                <div className="muted">Sem gols.</div>
                            ) : (
                                goals.map((g) => (
                                    <div key={g.goalId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="min-w-0">
                                            <div className="font-medium text-slate-900 truncate">
                                                {g.scorerName}
                                                {g.assistName ? <span className="text-slate-500"> • ass: {g.assistName}</span> : null}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">{g.time ?? "—"} • goalId: {g.goalId}</div>
                                        </div>

                                        <button
                                            className={cls("btn", removingGoal[g.goalId] && "opacity-50 pointer-events-none")}
                                            disabled={!!removingGoal[g.goalId]}
                                            onClick={() => onRemoveGoal(g.goalId)}
                                            title="Remover"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}