import { useState, useEffect } from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import type { GoalDto, PlayerInMatchDto, VoteCountDto, VoteDto } from "../matchTypes";
import { cls } from "../matchUtils";
import { GoalTracker } from "./GoalTracker";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";
import { PaymentsApi } from "../../../api/endpoints";
import { toast } from "sonner";

// ── Payment section (admin only) ────────────────────────────────────────────

function PaymentSection({
    paymentMode,
    groupId,
    matchDate,
    participantPlayerIds,
}: {
    paymentMode: number;
    groupId: string;
    matchDate?: string;
    participantPlayerIds: string[];
}) {
    const [gameAmount, setGameAmount] = useState("");
    const [creatingCharge, setCreatingCharge] = useState(false);

    // Monthly mode state
    const [isInitiated, setIsInitiated] = useState<boolean | null>(null);
    const [initiating, setInitiating] = useState(false);

    useEffect(() => {
        if (paymentMode !== 0 || !groupId || !matchDate) return;
        const d = new Date(matchDate);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        PaymentsApi.isMonthInitiated(groupId, year, month)
            .then(res => setIsInitiated(res.data?.isInitiated ?? false))
            .catch(() => setIsInitiated(false));
    }, [paymentMode, groupId, matchDate]);

    // PerGame mode
    if (paymentMode === 1) {
        const handleCreateCharge = async () => {
            const amount = parseFloat(gameAmount.replace(",", "."));
            if (!amount || amount <= 0) {
                toast.error("Informe um valor válido para o jogo.");
                return;
            }
            if (participantPlayerIds.length === 0) {
                toast.error("Sem jogadores para cobrar.");
                return;
            }
            const dateLabel = matchDate
                ? new Date(matchDate).toLocaleDateString("pt-BR")
                : "—";
            setCreatingCharge(true);
            try {
                await PaymentsApi.createExtraCharge(groupId, {
                    name: `Jogo — ${dateLabel}`,
                    amount,
                    playerIds: participantPlayerIds,
                });
                toast.success("Cobrança do jogo criada com sucesso!");
                setGameAmount("");
            } catch {
                toast.error("Erro ao criar cobrança do jogo.");
            } finally {
                setCreatingCharge(false);
            }
        };

        return (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={15} className="text-indigo-500 shrink-0" />
                    <div className="font-semibold text-slate-900">Cobrança do jogo</div>
                </div>
                <div className="text-xs text-slate-500 mb-3">
                    Crie uma cobrança para os {participantPlayerIds.length} jogadores desta partida.
                </div>
                <div className="flex items-end gap-3">
                    <label className="block flex-1 max-w-[160px]">
                        <div className="label">Valor (R$)</div>
                        <input
                            className="input h-9 text-sm"
                            value={gameAmount}
                            onChange={e => setGameAmount(e.target.value)}
                            placeholder="0,00"
                            type="number"
                            min="0"
                            step="0.01"
                        />
                    </label>
                    <button
                        className={cls(
                            "btn btn-primary",
                            (creatingCharge || !gameAmount) && "opacity-50 pointer-events-none"
                        )}
                        disabled={creatingCharge || !gameAmount}
                        onClick={handleCreateCharge}
                    >
                        {creatingCharge ? (
                            <><Loader2 size={14} className="animate-spin mr-1" />Criando...</>
                        ) : (
                            "Criar cobrança"
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Monthly mode
    const handleInitiateMonthly = async () => {
        if (!matchDate || !groupId) return;
        const d = new Date(matchDate);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        setInitiating(true);
        try {
            const res = await PaymentsApi.initiateMonthly(groupId, year, month);
            const { created, skipped } = res.data ?? {};
            toast.success(`Mensalidade lançada! ${created} novo(s), ${skipped} já existia(m).`);
            setIsInitiated(true);
        } catch {
            toast.error("Erro ao lançar mensalidade.");
        } finally {
            setInitiating(false);
        }
    };

    const dateLabel = matchDate
        ? new Date(matchDate).toLocaleString("pt-BR", { month: "long", year: "numeric" })
        : "—";

    return (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
                <CreditCard size={15} className="text-indigo-500 shrink-0" />
                <div className="font-semibold text-slate-900">Mensalidade</div>
            </div>
            <div className="text-xs text-slate-500 mb-3">
                Lança cobranças de mensalidade para todos os mensalistas — {dateLabel}.
            </div>

            {isInitiated === null ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin" /> Verificando...
                </div>
            ) : isInitiated ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-emerald-800">
                        Mensalidade já lançada para este mês
                    </span>
                </div>
            ) : (
                <button
                    className={cls(
                        "btn btn-primary",
                        initiating && "opacity-50 pointer-events-none"
                    )}
                    disabled={initiating}
                    onClick={handleInitiateMonthly}
                >
                    {initiating ? (
                        <><Loader2 size={14} className="animate-spin mr-1" />Lançando...</>
                    ) : (
                        "Lançar mensalidade do mês"
                    )}
                </button>
            )}
        </div>
    );
}

// ── StepPost ─────────────────────────────────────────────────────────────────

export function StepPost({
    admin,
    currentMvpName,
    votes,
    voteCounts,
    participants,
    onRefresh,
    onFinalize,
    activeMatchPlayerId,

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
    addingGoal,
    onAddGoal,
    goals,
    removingGoal,
    onRemoveGoal,

    // team identity
    teamAName,
    teamAHex,
    teamBName,
    teamBHex,

    // payment
    paymentMode,
    groupId,
    matchDate,
}: {
    admin: boolean;
    currentMvpName: string;
    votes: VoteDto[];
    voteCounts: VoteCountDto[];
    participants: PlayerInMatchDto[];
    onRefresh: () => void;
    onFinalize: () => void;
    activeMatchPlayerId: string;

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

    addingGoal: boolean;
    onAddGoal: (scorerPlayerId: string, assistPlayerId: string | null, time: string) => Promise<void>;
    goals: GoalDto[];
    removingGoal: Record<string, boolean>;
    onRemoveGoal: (goalId: string) => void;

    teamAName?: string;
    teamAHex?: string;
    teamBName?: string;
    teamBHex?: string;

    paymentMode?: number;
    groupId?: string;
    matchDate?: string;
}) {
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    // ── Non-admin read-only view (with own vote) ────────────────────────────
    if (!admin) {
        const scoreText =
            currentScoreA == null || currentScoreB == null
                ? "—"
                : `${currentScoreA} × ${currentScoreB}`;

        // Find if this player already voted
        const myVote = votes.find((v) => v.voterMatchPlayerId === activeMatchPlayerId);
        const hasVoted = !!myVote;
        const isParticipant = !!activeMatchPlayerId;

        return (
            <div className="card p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="font-semibold">Pós-jogo</div>
                        <div className="text-xs text-slate-500">
                            Visualização + voto MVP
                        </div>
                    </div>
                    <span className="pill">{currentMvpName || "MVP —"}</span>
                </div>

                {/* Score */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                        Placar
                    </div>
                    <div className="text-4xl font-extrabold text-slate-900">{scoreText}</div>
                </div>

                {/* Voting section */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <IconRenderer value={resolveIcon(_icons, 'mvp')} size={15} lucideProps={{ className: "text-amber-500 shrink-0" }} />
                        <div className="font-semibold text-slate-900 text-sm">Seu voto MVP</div>
                    </div>

                    {!isParticipant ? (
                        <div className="text-sm text-slate-400">
                            Você não está entre os participantes desta partida.
                        </div>
                    ) : hasVoted ? (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-3">
                            <div className="flex items-center gap-2">
                                <Check size={14} className="text-emerald-600 shrink-0" />
                                <span className="text-sm font-semibold text-emerald-800">
                                    Você já votou no MVP
                                </span>
                            </div>
                            <div className="mt-1 text-sm text-slate-600 pl-[22px]">
                                Votado:{" "}
                                <b className="text-slate-900">{myVote!.votedForName}</b>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                {participants
                                    .filter((p) => p.matchPlayerId !== activeMatchPlayerId)
                                    .map((p) => {
                                        const isSelected = voteVotedMpId === p.matchPlayerId;
                                        return (
                                            <button
                                                key={p.matchPlayerId}
                                                className={cls(
                                                    "w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                                    isSelected
                                                        ? "border-emerald-400 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                                                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                                                )}
                                                onClick={() => setVoteVotedMpId(isSelected ? "" : p.matchPlayerId)}
                                            >
                                                <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}
                                                {p.playerName}
                                            </button>
                                        );
                                    })}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    className={cls(
                                        "btn btn-primary",
                                        (!voteVotedMpId || voting) &&
                                            "opacity-50 pointer-events-none"
                                    )}
                                    disabled={!voteVotedMpId || voting}
                                    onClick={onVoteMvp}
                                >
                                    {voting ? "Votando..." : "Votar"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Goals — qualquer usuário pode marcar, ninguém pode remover */}
                <GoalTracker
                    participants={participants}
                    goals={goals}
                    addingGoal={addingGoal}
                    onAddGoal={onAddGoal}
                    removingGoal={removingGoal}
                    onRemoveGoal={onRemoveGoal}
                    canRemove={false}
                    teamAName={teamAName}
                    teamAHex={teamAHex}
                    teamBName={teamBName}
                    teamBHex={teamBHex}
                />
            </div>
        );
    }

    // ── Admin view ──────────────────────────────────────────────────────────
    const hasCurrentScore = currentScoreA != null && currentScoreB != null;

    // Players who have already voted (by matchPlayerId)
    const votedMatchPlayerIds = new Set(votes.map((v) => v.voterMatchPlayerId));

    // Participants still eligible to vote (not voted yet)
    const eligibleVoters = participants.filter(
        (p) => !votedMatchPlayerIds.has(p.matchPlayerId)
    );

    // Player IDs for payment charge (non-guest participants with a playerId)
    const participantPlayerIds = participants
        .map(p => p.playerId)
        .filter((id): id is string => !!id);

    const showPaymentSection = paymentMode != null && groupId;

    return (
        <div className="space-y-4">
            <div className="card p-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="font-semibold">Pós-jogo</div>
                        <div className="text-xs text-slate-500">
                            Voto MVP • Placar • Gols • Finalizar
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="btn" onClick={onRefresh}>
                            Recarregar
                        </button>
                        <button className="btn btn-primary" onClick={onFinalize}>
                            Finalizar
                        </button>
                    </div>
                </div>

                {/* Current score display */}
                {hasCurrentScore && (
                    <div className="mt-4 rounded-xl bg-slate-900 text-white p-4 text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                            Placar atual
                        </div>
                        <div className="text-4xl font-extrabold tabular-nums">
                            {currentScoreA}{" "}
                            <span className="text-slate-500 mx-1">×</span>{" "}
                            {currentScoreB}
                        </div>
                    </div>
                )}

                {/* MVP voting */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <IconRenderer value={resolveIcon(_icons, 'mvp')} size={15} lucideProps={{ className: "text-amber-500 shrink-0" }} />
                        <div className="font-semibold text-slate-900">Votar MVP</div>
                    </div>
                    <div className="text-xs text-slate-500">
                        Admin pode votar por qualquer jogador ainda não votado.
                        {participants.length > 0 && (
                            <span className="ml-1">
                                ({votes.length}/{participants.length} votaram)
                            </span>
                        )}
                    </div>

                    {eligibleVoters.length === 0 && participants.length > 0 ? (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                            <Check size={14} className="text-emerald-600 shrink-0" />
                            <span className="text-sm font-semibold text-emerald-800">
                                Todos os jogadores já votaram no MVP
                            </span>
                        </div>
                    ) : (
                    <>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        {/* Quem vota */}
                        <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                Quem vota
                                {eligibleVoters.length < participants.length && (
                                    <span className="ml-1 text-[10px] text-slate-400 normal-case tracking-normal font-normal">
                                        ({participants.length - eligibleVoters.length} já votou)
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                {eligibleVoters.map((p) => {
                                    const isSelected = voteVoterMpId === p.matchPlayerId;
                                    return (
                                        <button
                                            key={p.matchPlayerId}
                                            className={cls(
                                                "w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                                isSelected
                                                    ? "border-emerald-400 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                                                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                                            )}
                                            onClick={() => {
                                                const next = isSelected ? "" : p.matchPlayerId;
                                                setVoteVoterMpId(next);
                                                setVoteVotedMpId("");
                                            }}
                                        >
                                            <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}
                                            {p.playerName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Votado */}
                        <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                Votado
                            </div>
                            <div className="space-y-1.5">
                                {participants
                                    .filter((p) => p.matchPlayerId !== voteVoterMpId)
                                    .map((p) => {
                                        const isSelected = voteVotedMpId === p.matchPlayerId;
                                        return (
                                            <button
                                                key={p.matchPlayerId}
                                                className={cls(
                                                    "w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                                    isSelected
                                                        ? "border-emerald-400 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                                                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                                                )}
                                                onClick={() => setVoteVotedMpId(isSelected ? "" : p.matchPlayerId)}
                                            >
                                                <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}
                                                {p.playerName}
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-xs text-slate-500">
                            MVP atual:{" "}
                            <b>{currentMvpName?.trim() ? currentMvpName : "—"}</b>
                        </div>

                        <button
                            className={cls(
                                "btn btn-primary",
                                (!voteVotedMpId || voting || !voteVoterMpId) &&
                                    "opacity-50 pointer-events-none"
                            )}
                            disabled={!voteVotedMpId || voting || !voteVoterMpId}
                            onClick={onVoteMvp}
                        >
                            {voting ? "Votando..." : "Votar"}
                        </button>
                    </div>
                    </>
                    )} {/* end eligibleVoters > 0 */}

                    {/* Vote counts + individual votes */}
                    <div className="mt-4">
                        <div className="text-sm font-semibold text-slate-900">Parciais</div>
                        <div className="mt-2 grid gap-2">
                            {voteCounts.length === 0 ? (
                                <div className="muted">Sem votos ainda.</div>
                            ) : (
                                voteCounts.map((v) => (
                                    <div
                                        key={v.votedForMatchPlayerId}
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                    >
                                        <div className="font-medium text-slate-900 truncate">
                                            {v.votedForName}
                                        </div>
                                        <span className="pill">{v.count}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Who voted for whom (detailed breakdown) */}
                        {votes.length > 0 && (
                            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-medium text-slate-500 mb-1.5">
                                    Detalhamento
                                </div>
                                <div className="grid gap-1">
                                    {votes.map((v) => (
                                        <div
                                            key={v.voteId}
                                            className="flex items-center gap-1.5 text-xs text-slate-600"
                                        >
                                            <span className="text-slate-400 truncate">
                                                {v.voterName}
                                            </span>
                                            <span className="text-slate-300">→</span>
                                            <span className="font-medium text-slate-700 truncate">
                                                {v.votedForName}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Score */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">Placar</div>
                    <div className="text-xs text-slate-500">
                        Você pode setar manualmente (ou deixar pelos gols).
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 max-w-full sm:max-w-[420px]">
                        <label className="block">
                            <div className="label">Time A</div>
                            <input
                                className="input h-9 text-sm"
                                value={scoreA}
                                onChange={(e) => setScoreA(e.target.value)}
                                placeholder="0"
                            />
                        </label>
                        <label className="block">
                            <div className="label">Time B</div>
                            <input
                                className="input h-9 text-sm"
                                value={scoreB}
                                onChange={(e) => setScoreB(e.target.value)}
                                placeholder="0"
                            />
                        </label>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-xs text-slate-500">
                            Atual:{" "}
                            <b>{currentScoreA ?? "—"}</b> × <b>{currentScoreB ?? "—"}</b>
                        </div>

                        <button
                            className={cls(
                                "btn btn-primary",
                                settingScore && "opacity-50 pointer-events-none"
                            )}
                            disabled={settingScore}
                            onClick={onSetScore}
                        >
                            {settingScore ? "Salvando..." : "Salvar placar"}
                        </button>
                    </div>
                </div>

                {/* Goals — GoalTracker (admin pode remover) */}
                <div className="mt-4">
                    <GoalTracker
                        participants={participants}
                        goals={goals}
                        addingGoal={addingGoal}
                        onAddGoal={onAddGoal}
                        removingGoal={removingGoal}
                        onRemoveGoal={onRemoveGoal}
                        canRemove={true}
                        teamAName={teamAName}
                        teamAHex={teamAHex}
                        teamBName={teamBName}
                        teamBHex={teamBHex}
                    />
                </div>

                {/* Payment section */}
                {showPaymentSection && (
                    <PaymentSection
                        paymentMode={paymentMode!}
                        groupId={groupId!}
                        matchDate={matchDate}
                        participantPlayerIds={participantPlayerIds}
                    />
                )}
            </div>
        </div>
    );
}
