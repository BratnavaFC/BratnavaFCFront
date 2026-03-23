import { useMemo } from "react";
import { Clock, MapPin, Users } from "lucide-react";
import { Stepper, Step } from "../../../components/Stepper";
import type { StepKey } from "../matchTypes";
import { StepCreate } from "../steps/StepCreate";
import { StepAccept } from "../steps/StepAccept";
import { StepTeams } from "../steps/StepTeams";
import { StepPlaying } from "../steps/StepPlaying";
import { StepEnded } from "../steps/StepEnded";
import { StepPost } from "../steps/StepPost";
import { StepDone } from "../steps/StepDone";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    create:  { label: "Criação",    color: "text-slate-600",   bg: "bg-slate-100"  },
    accept:  { label: "Aceitação",  color: "text-blue-700",    bg: "bg-blue-50"    },
    teams:   { label: "Times",      color: "text-purple-700",  bg: "bg-purple-50"  },
    playing: { label: "Em Jogo",    color: "text-emerald-700", bg: "bg-emerald-50" },
    ended:   { label: "Encerrado",  color: "text-amber-700",   bg: "bg-amber-50"   },
    post:    { label: "Pós-jogo",   color: "text-orange-700",  bg: "bg-orange-50"  },
    done:    { label: "Finalizado", color: "text-slate-600",   bg: "bg-slate-100"  },
};

const ACCENT_HEX: Record<string, string> = {
    create:  "#64748b",
    accept:  "#3b82f6",
    teams:   "#9333ea",
    playing: "#10b981",
    ended:   "#f59e0b",
    post:    "#f97316",
    done:    "#64748b",
};

export function MatchWizard({
    admin,
    stepKey,
    steps,

    // top summary
    current,
    loading,
    maxPlayers,
    acceptedCount,
    pendingCount,
    acceptedOverLimit,

    // create
    placeName,
    setPlaceName,
    playedAtDate,
    setPlayedAtDate,
    playedAtTime,
    setPlayedAtTime,
    canCreateMatch,
    creating,
    onCreateMatch,
    currentExistsInCreate,

    // accept
    accepted,
    rejected,
    pending,
    mutatingInvite,
    activePlayerId,
    onAcceptInvite,
    onRejectInvite,
    onRefresh,
    onGoToMatchMaking,
    onAddGuest,
    onSetPlayerRole,

    // teams
    teamsProps,

    // playing/ended/post/done
    onEndMatch,
    onGoToPostGame,
    postProps,
    playingGoalProps,
    onFinalize,
    onReloadDone,
}: any) {
    const meta      = STATUS_META[stepKey as string] ?? STATUS_META.create;
    const accentHex = ACCENT_HEX[stepKey as string]  ?? "#64748b";

    const header = useMemo(() => {
        if (!current) return null;

        const acceptPct =
            maxPlayers > 0
                ? Math.min(100, Math.round((acceptedCount / maxPlayers) * 100))
                : 0;

        return (
            <div className="card overflow-hidden p-0">
                {/* Accent strip */}
                <div className="h-1 w-full" style={{ background: accentHex }} />

                <div className="p-4 space-y-3">
                    {/* Status badge + date/place + player count */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                            <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.color}`}
                            >
                                {meta.label}
                            </span>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                                {current?.playedAt && (
                                    <span className="flex items-center gap-1">
                                        <Clock size={13} className="text-slate-400 shrink-0" />
                                        {new Date(current.playedAt).toLocaleString("pt-BR", {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        })}
                                    </span>
                                )}
                                {current?.placeName && (
                                    <span className="flex items-center gap-1">
                                        <MapPin size={13} className="text-slate-400 shrink-0" />
                                        {current.placeName}
                                    </span>
                                )}
                            </div>
                        </div>

                        {stepKey === "accept" && (
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                    <Users size={14} className="text-slate-400" />
                                    {acceptedCount}/{maxPlayers}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    Pendentes: {pendingCount}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Acceptance progress bar (only during accept step) */}
                    {stepKey === "accept" && (
                        <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                <span>Confirmados</span>
                                <span>{acceptPct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${acceptPct}%`, background: accentHex }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Over-limit warning */}
                    {acceptedOverLimit && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                            Passou do limite: <b>{acceptedCount}</b> / <b>{maxPlayers}</b>.{" "}
                            {admin
                                ? "Recuse alguns para avançar."
                                : "Aguarde o admin ajustar."}
                        </div>
                    )}

                </div>
            </div>
        );
    }, [
        current,
        acceptedCount,
        pendingCount,
        maxPlayers,
        acceptedOverLimit,
        admin,
        stepKey,
        meta,
        accentHex,
    ]);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <span className="pill">
                    {loading ? "carregando..." : current ? "ativa" : "sem partida"}
                </span>
            </div>

            <Stepper steps={steps as Step[]} activeKey={stepKey as StepKey} />

            {stepKey !== "create" ? header : null}

            {stepKey === "create" ? (
                <StepCreate
                    admin={admin}
                    placeName={placeName}
                    setPlaceName={setPlaceName}
                    playedAtDate={playedAtDate}
                    setPlayedAtDate={setPlayedAtDate}
                    playedAtTime={playedAtTime}
                    setPlayedAtTime={setPlayedAtTime}
                    canCreateMatch={canCreateMatch}
                    creating={creating}
                    onCreate={onCreateMatch}
                    currentExistsInCreate={currentExistsInCreate}
                />
            ) : null}

            {stepKey === "accept" ? (
                <StepAccept
                    admin={admin}
                    accepted={accepted}
                    rejected={rejected}
                    pending={pending}
                    mutatingInvite={mutatingInvite}
                    activePlayerId={activePlayerId}
                    acceptedOverLimit={acceptedOverLimit}
                    onAccept={onAcceptInvite}
                    onReject={onRejectInvite}
                    onRefresh={onRefresh}
                    onGoToMatchMaking={onGoToMatchMaking}
                    onAddGuest={onAddGuest}
                    onSetPlayerRole={onSetPlayerRole}
                />
            ) : null}

            {stepKey === "teams" ? <StepTeams {...teamsProps} /> : null}

            {stepKey === "playing" ? (
                <StepPlaying
                    admin={admin}
                    onRefresh={onRefresh}
                    onEnd={onEndMatch}
                    {...(playingGoalProps ?? {})}
                />
            ) : null}

            {stepKey === "ended" ? (
                <StepEnded admin={admin} onRefresh={onRefresh} onGoToPostGame={onGoToPostGame} />
            ) : null}

            {stepKey === "post" ? (
                <StepPost {...postProps} admin={admin} onRefresh={onRefresh} onFinalize={onFinalize} />
            ) : null}

            {stepKey === "done" ? (
                <StepDone
                    admin={admin}
                    scoreA={current?.teamAGoals}
                    scoreB={current?.teamBGoals}
                    mvp={current?.computedMvp?.playerName ?? ""}
                    onReload={onReloadDone}
                />
            ) : null}
        </div>
    );
}
