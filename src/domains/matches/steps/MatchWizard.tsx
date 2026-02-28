import { useMemo } from "react";
import { Stepper, Step } from "../../../components/Stepper";
import type { MatchDetailsDto, StepKey } from "../matchTypes";
import { StepCreate } from "../steps/StepCreate";
import { StepAccept } from "../steps/StepAccept";
import { StepTeams } from "../steps/StepTeams";
import { StepPlaying } from "../steps/StepPlaying";
import { StepEnded } from "../steps/StepEnded";
import { StepPost } from "../steps/StepPost";
import { StepDone } from "../steps/StepDone";

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

    // teams
    teamsProps,

    // playing/ended/post/done
    onEndMatch,
    onGoToPostGame,
    postProps,
    onFinalize,
    onReloadDone,
}: any) {
    const header = useMemo(() => {
        if (!current) return null;
        return (
            <div className="card p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="font-semibold">Partida Atual</div>
                        <div className="muted mt-1 truncate">
                            {current?.playedAt ? new Date(current?.playedAt).toLocaleString() : "�"} � {current?.placeName ?? "�"}
                        </div>
                        <div className="muted">Status: {String(current?.statusName ?? current?.status)}</div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                        <span className="pill">Aceitos: {acceptedCount}/{maxPlayers}</span>
                        <span className="pill">Pendentes: {pendingCount}</span>
                    </div>
                </div>

                {acceptedOverLimit ? (
                    <div className="mt-3 text-sm text-red-700">
                        Passou do limite de aceitos: <b>{acceptedCount}</b> / <b>{maxPlayers}</b>. {admin ? "Recuse alguns para poder avan�ar." : "Aguarde o admin ajustar."}
                    </div>
                ) : null}

                {!admin ? (
                    <div className="mt-3 text-xs text-slate-500">
                        Modo usu�rio: voc� s� consegue <b>aceitar/recusar o seu pr�prio convite</b> quando estiver em �Aceita��o�. O restante � controlado pelo admin.
                    </div>
                ) : null}
            </div>
        );
    }, [current, acceptedCount, pendingCount, maxPlayers, acceptedOverLimit, admin]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">Partida (Match Wizard)</div>
                <span className="pill">{loading ? "carregando..." : current ? "ativa" : "sem partida"}</span>
            </div>

            <Stepper steps={steps as Step[]} activeKey={stepKey as StepKey} />

            {/* header some steps */}
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
                />
            ) : null}

            {stepKey === "teams" ? <StepTeams {...teamsProps} /> : null}

            {stepKey === "playing" ? (
                <StepPlaying admin={admin} onRefresh={onRefresh} onEnd={onEndMatch} />
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