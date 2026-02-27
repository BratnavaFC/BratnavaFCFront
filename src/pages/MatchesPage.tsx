import { useEffect, useMemo, useState } from "react";
import { Section } from "../components/Section";
import { MatchesApi, TeamColorApi, TeamGenApi, GroupSettingsApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isAdmin } from "../auth/guards";

import { MatchWizard } from "../domains/matches/steps/MatchWizard";
import type {
    ColorMode,
    GroupSettingsDto,
    MatchDetailsDto,
    PlayerInMatchDto,
    StrategyId,
    TeamColorDto,
    TeamGenPlayerDto,
    TeamOptionDto,
    StepKey,
} from "../domains/matches/matchTypes";
import { InviteResponse } from "../domains/matches/matchTypes";
import {
    buildAllPlayers,
    cls,
    getMaxPlayers,
    getMatchId,
    isValidHHmm,
    normalizeTeamGenOptions,
    pickActiveMatch,
    toDateInputValue,
    toUtcIso,
    uniqById,
} from "../domains/matches/matchUtils";

import { STRATEGIES } from "../domains/matches/matchTypes";

export default function MatchesPage() {
    const store = useAccountStore();
    const active = store.getActive();
    const groupId = active?.activeGroupId;

    const activePlayerId: string | null = (active as any)?.activePlayerId ?? null;
    const admin = isAdmin();
    const readOnlyUser = !admin;

    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
    const [current, setCurrent] = useState<MatchDetailsDto | null>(null);

    const [teamColors, setTeamColors] = useState<TeamColorDto[]>([]);
    const [groupSettings, setGroupSettings] = useState<GroupSettingsDto | null>(null);

    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const [mutatingInvite, setMutatingInvite] = useState<Record<string, boolean>>({});

    // create match
    const [placeName, setPlaceName] = useState("");
    const [playedAtDate, setPlayedAtDate] = useState(() => toDateInputValue(new Date()));
    const [playedAtTime, setPlayedAtTime] = useState("");

    // teamgen
    const [strategyType, setStrategyType] = useState<StrategyId>(3);
    const [includeGoalkeepers, setIncludeGoalkeepers] = useState(true);
    const [playersPerTeam, setPlayersPerTeam] = useState(6);

    // colors
    const [colorMode, setColorMode] = useState<ColorMode>("manual");
    const [teamAColorId, setTeamAColorId] = useState<string>("");
    const [teamBColorId, setTeamBColorId] = useState<string>("");

    const [colorsLocked, setColorsLocked] = useState<boolean>(false);
    const [allowEditColors, setAllowEditColors] = useState<boolean>(false);

    // assign/swap
    const [assigningTeams, setAssigningTeams] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [swapA, setSwapA] = useState<string>("");
    const [swapB, setSwapB] = useState<string>("");

    // post-game
    const [settingScore, setSettingScore] = useState(false);
    const [scoreA, setScoreA] = useState<string>("");
    const [scoreB, setScoreB] = useState<string>("");

    const [voting, setVoting] = useState(false);
    const [voteVoterMpId, setVoteVoterMpId] = useState<string>("");
    const [voteVotedMpId, setVoteVotedMpId] = useState<string>("");

    const [addingGoal, setAddingGoal] = useState(false);
    const [goalScorerPlayerId, setGoalScorerPlayerId] = useState<string>("");
    const [goalAssistPlayerId, setGoalAssistPlayerId] = useState<string>("");
    const [goalTime, setGoalTime] = useState<string>("");

    const [removingGoal, setRemovingGoal] = useState<Record<string, boolean>>({});
    const [finalizing, setFinalizing] = useState(false);

    const [teamGenOptions, setTeamGenOptions] = useState<TeamOptionDto[] | null>(null);
    const [selectedTeamGenIdx, setSelectedTeamGenIdx] = useState<number>(0);

    const maxPlayers = useMemo(() => getMaxPlayers(groupSettings), [groupSettings]);

    const placeNameOk = placeName.trim().length > 0;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(playedAtDate);
    const timeOk = isValidHHmm(playedAtTime);
    const canCreateMatch = admin && !!groupId && placeNameOk && dateOk && timeOk && !creating;

    async function loadDetails(matchId: string) {
        if (!groupId || !matchId) return;
        const res = await MatchesApi.details(groupId, matchId);
        setCurrent(res.data as MatchDetailsDto);
    }

    async function loadList() {
        if (!groupId) return;
        setLoading(true);
        try {
            const [matchesRes, colorsRes, settingsRes] = await Promise.all([
                MatchesApi.list(groupId),
                TeamColorApi.list(groupId),
                GroupSettingsApi.get(groupId),
            ]);

            const list = matchesRes.data ?? [];
            setMatches(list);

            const colors = (colorsRes.data ?? []) as TeamColorDto[];
            setTeamColors(colors);

            const gs = (settingsRes.data ?? null) as GroupSettingsDto | null;
            setGroupSettings(gs);

            if (gs) {
                const suggestedPlace = gs.defaultPlaceName ?? gs.placeName;
                const suggestedTime = gs.defaultMatchTime ?? gs.matchTime;
                setPlaceName((prev) => (prev.trim().length ? prev : suggestedPlace ?? ""));
                setPlayedAtTime((prev) => (prev.trim().length ? prev : suggestedTime ?? ""));
            }

            const activeMatch = pickActiveMatch(list);
            const id = getMatchId(activeMatch);

            setCurrentMatchId(id);
            if (!id) setCurrent(null);
            else await loadDetails(id);
        } finally {
            setLoading(false);
        }
    }

    async function refreshCurrent() {
        if (!currentMatchId) return;
        await loadDetails(currentMatchId);
    }

    async function createMatch() {
        if (!canCreateMatch) return;
        setCreating(true);
        try {
            const playedAt = toUtcIso(playedAtDate, playedAtTime);
            await MatchesApi.create(groupId!, { placeName: placeName.trim(), playedAt } as any);
            await loadList();
        } finally {
            setCreating(false);
        }
    }

    // step key
    const stepKey: StepKey = useMemo(() => {
        if (!current) return "create";
        const s = Number(current?.status);

        if (s === 0) return "create";
        if (s === 1) return "accept";
        if (s === 2) return "teams";
        if (s === 3) return "playing";
        if (s === 4) return "ended";
        if (s === 5) return "post";
        if (s === 6) return "done";
        return "create";
    }, [current?.status, current?.matchId]);

    function stepsOrderDone(k: StepKey, activeK: StepKey) {
        const order: StepKey[] = ["create", "accept", "teams", "playing", "ended", "post", "done"];
        return order.indexOf(k) < order.indexOf(activeK);
    }

    const steps = useMemo(() => {
        const s = [
            { key: "create", title: "Criar", subtitle: "Nova partida" },
            { key: "accept", title: "Aceitação", subtitle: "Aceitar / Recusar" },
            { key: "teams", title: "MatchMaking", subtitle: "Times / cores / swap" },
            { key: "playing", title: "Jogo", subtitle: "Iniciada" },
            { key: "ended", title: "Encerrar", subtitle: "Fim do jogo" },
            { key: "post", title: "Pós-jogo", subtitle: "MVP / gols / placar" },
            { key: "done", title: "Final", subtitle: "Finalizada" },
        ].map((x) => ({ ...x, done: stepsOrderDone(x.key as StepKey, stepKey) }));

        return s;
    }, [stepKey]);

    // derived lists
    const allPlayers = useMemo<PlayerInMatchDto[]>(() => buildAllPlayers(current), [current]);

    const invitePool = useMemo<PlayerInMatchDto[]>(() => {
        const list = current?.unassignedPlayers ?? [];
        return Array.isArray(list) ? list : [];
    }, [current]);

    const accepted = useMemo(() => invitePool.filter((p) => Number(p.inviteResponse) === InviteResponse.Accepted), [invitePool]);
    const rejected = useMemo(() => invitePool.filter((p) => Number(p.inviteResponse) === InviteResponse.Rejected), [invitePool]);
    const pending = useMemo(() => invitePool.filter((p) => Number(p.inviteResponse) === InviteResponse.None), [invitePool]);

    const acceptedOverLimit = accepted.length > maxPlayers;

    const participants = useMemo<PlayerInMatchDto[]>(() => {
        if (!current) return [];

        const a = Array.isArray(current?.teamAPlayers) ? current?.teamAPlayers : [];
        const b = Array.isArray(current?.teamBPlayers) ? current?.teamBPlayers : [];
        const base = [...a, ...b];

        const fallback = allPlayers.filter((p) => Number(p.team) === 1 || Number(p.team) === 2);
        const list = base.length ? base : fallback;

        const map = new Map<string, PlayerInMatchDto>();
        for (const p of list) if (p?.playerId) map.set(String(p.playerId), p);
        return Array.from(map.values());
    }, [current, allPlayers]);

    // auto load
    useEffect(() => {
        loadList();
        // eslint-disable-next-line
    }, [groupId]);

    // user auto-refresh
    useEffect(() => {
        if (!readOnlyUser) return;
        if (!groupId) return;

        const t = window.setInterval(() => {
            loadList();
        }, 15000);

        return () => window.clearInterval(t);
        // eslint-disable-next-line
    }, [readOnlyUser, groupId]);

    // lock colors when current has them
    useEffect(() => {
        if (!current) return;

        const aId = current?.teamAColor?.id ?? "";
        const bId = current?.teamBColor?.id ?? "";
        const alreadySet = !!aId || !!bId;

        if (aId) setTeamAColorId(aId);
        if (bId) setTeamBColorId(bId);

        setColorsLocked(alreadySet);
        setAllowEditColors(false);
    }, [current?.matchId, current?.teamAColor?.id, current?.teamBColor?.id]); // eslint-disable-line

    useEffect(() => {
        if (!teamColors?.length) return;
        setTeamAColorId((prev) => prev || String(teamColors[0]?.id ?? ""));
        setTeamBColorId((prev) => prev || String((teamColors[1] ?? teamColors[0])?.id ?? ""));
    }, [teamColors]);

    const colorsReadOnly = useMemo(() => {
        if (!admin) return true;
        if (!colorsLocked) return false;
        return !allowEditColors;
    }, [admin, colorsLocked, allowEditColors]);

    const teamAColor = useMemo(() => teamColors.find((c) => String(c.id) === String(teamAColorId)) ?? null, [teamColors, teamAColorId]);
    const teamBColor = useMemo(() => teamColors.find((c) => String(c.id) === String(teamBColorId)) ?? null, [teamColors, teamBColorId]);

    const teamsAlreadyAssigned = useMemo(() => {
        const a = current?.teamAPlayers?.length ?? 0;
        const b = current?.teamBPlayers?.length ?? 0;
        return a > 0 && b > 0;
    }, [current?.teamAPlayers, current?.teamBPlayers]);

    const sortedTeamAPlayers = useMemo(() => {
        const a = Array.isArray(current?.teamAPlayers) ? current!.teamAPlayers : [];
        return [...a].sort((x, y) => Number(y.isGoalkeeper) - Number(x.isGoalkeeper));
    }, [current?.teamAPlayers]);

    const sortedTeamBPlayers = useMemo(() => {
        const b = Array.isArray(current?.teamBPlayers) ? current!.teamBPlayers : [];
        return [...b].sort((x, y) => Number(y.isGoalkeeper) - Number(x.isGoalkeeper));
    }, [current?.teamBPlayers]);

    // actions
    async function acceptInvite(playerId: string) {
        if (!groupId || !currentMatchId) return;

        setMutatingInvite((prev) => ({ ...prev, [playerId]: true }));
        try {
            await MatchesApi.accept(groupId, currentMatchId, { playerId } as any);
            await refreshCurrent();
        } finally {
            setMutatingInvite((prev) => ({ ...prev, [playerId]: false }));
        }
    }

    async function rejectInvite(playerId: string) {
        if (!groupId || !currentMatchId) return;

        setMutatingInvite((prev) => ({ ...prev, [playerId]: true }));
        try {
            await MatchesApi.reject(groupId, currentMatchId, { playerId } as any);
            await refreshCurrent();
        } finally {
            setMutatingInvite((prev) => ({ ...prev, [playerId]: false }));
        }
    }

    async function goToMatchMaking() {
        if (!admin || !groupId || !currentMatchId) return;
        await MatchesApi.goToMatchMaking(groupId, currentMatchId);
        await refreshCurrent();
    }

    async function startMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        await MatchesApi.start(groupId, currentMatchId);
        await refreshCurrent();
    }

    async function endMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        await MatchesApi.end(groupId, currentMatchId);
        await refreshCurrent();
    }

    async function goToPostGame() {
        if (!admin || !groupId || !currentMatchId) return;
        await MatchesApi.goToPostGame(groupId, currentMatchId);
        await refreshCurrent();
    }

    async function finalizeMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        setFinalizing(true);
        try {
            await MatchesApi.finalize(groupId, currentMatchId);
            await loadList();
        } finally {
            setFinalizing(false);
        }
    }

    // matchmaking: teamgen + assign + colors + swap
    async function generateTeams() {
        if (!groupId || !current) return;

        const acceptedAll = allPlayers.filter((p) => Number(p.inviteResponse) === InviteResponse.Accepted);

        const players: TeamGenPlayerDto[] = uniqById(
            acceptedAll
                .filter((p) => typeof p.playerId === "string" && p.playerId.trim().length > 0)
                .map((p) => ({
                    id: p.playerId,
                    name: p.playerName ?? "—",
                    isGoalkeeper: !!p.isGoalkeeper,
                }))
        );

        if (players.length < 2) return;

        const req = { players, strategyType, playersPerTeam, includeGoalkeepers, optionsCount: 3 };
        const res = await TeamGenApi.generate(req as any);
        const options = normalizeTeamGenOptions(res.data);

        setTeamGenOptions(options);
        setSelectedTeamGenIdx(0);
    }

    async function setColorsRandomDistinct() {
        if (!groupId || !currentMatchId) return;

        const colors = (teamColors ?? []).filter((c) => c?.id);
        if (colors.length < 2) return;

        const shuffled = [...colors].sort(() => Math.random() - 0.5);
        const a = shuffled[0];
        const b = shuffled.find((x) => x.id !== a.id) ?? shuffled[1];

        await MatchesApi.setColors(groupId, currentMatchId, { teamAColorId: a.id, teamBColorId: b.id } as any);

        setTeamAColorId(String(a.id));
        setTeamBColorId(String(b.id));
        await refreshCurrent();
    }

    async function applyManualColors() {
        if (!groupId || !currentMatchId) return;
        if (!teamAColorId || !teamBColorId) return;
        await MatchesApi.setColors(groupId, currentMatchId, { teamAColorId, teamBColorId } as any);
        await refreshCurrent();
    }

    async function assignTeamsFromGenerated() {
        if (!admin || !groupId || !currentMatchId) return;
        if (!teamGenOptions || teamGenOptions.length === 0) return;

        const opt = teamGenOptions[Math.max(0, Math.min(selectedTeamGenIdx, teamGenOptions.length - 1))];
        const teamAPlayerIds = Array.isArray(opt.teamA) ? opt.teamA.map((x) => x.playerId) : [];
        const teamBPlayerIds = Array.isArray(opt.teamB) ? opt.teamB.map((x) => x.playerId) : [];
        if (teamAPlayerIds.length === 0 || teamBPlayerIds.length === 0) return;

        setAssigningTeams(true);
        try {
            await MatchesApi.assignTeams(groupId, currentMatchId, {
                TeamAMatchPlayerIds: teamAPlayerIds,
                TeamBMatchPlayerIds: teamBPlayerIds,
            } as any);

            await refreshCurrent();
        } finally {
            setAssigningTeams(false);
        }
    }

    async function swapPlayers() {
        if (!admin || !groupId || !currentMatchId) return;
        if (!swapA || !swapB) return;

        setSwapping(true);
        try {
            await MatchesApi.swap(groupId, currentMatchId, { playerAId: swapA, playerBId: swapB } as any);
            setSwapA("");
            setSwapB("");
            await refreshCurrent();
        } finally {
            setSwapping(false);
        }
    }

    const canStartNow = useMemo(() => admin && stepKey === "teams" && teamsAlreadyAssigned, [admin, stepKey, teamsAlreadyAssigned]);

    // postgame
    async function setScore() {
        if (!admin || !groupId || !currentMatchId) return;

        const a = Number(scoreA);
        const b = Number(scoreB);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return;

        setSettingScore(true);
        try {
            await MatchesApi.setScore(groupId, currentMatchId, { teamAGoals: a, teamBGoals: b } as any);
            await refreshCurrent();
        } finally {
            setSettingScore(false);
        }
    }

    async function voteMvp() {
        if (!groupId || !currentMatchId) return;
        if (!voteVoterMpId || !voteVotedMpId) return;

        setVoting(true);
        try {
            await MatchesApi.vote(groupId, currentMatchId, { voterPlayerId: voteVoterMpId, votedPlayerId: voteVotedMpId } as any);
            await refreshCurrent();
        } finally {
            setVoting(false);
        }
    }

    async function addGoal() {
        if (!admin || !groupId || !currentMatchId) return;
        if (!goalScorerPlayerId) return;
        if (!goalTime.trim()) return;

        setAddingGoal(true);
        try {
            await MatchesApi.addGoal(groupId, currentMatchId, {
                scorerPlayerId: goalScorerPlayerId,
                assistPlayerId: goalAssistPlayerId?.trim() ? goalAssistPlayerId : null,
                time: goalTime.trim(),
            } as any);

            setGoalScorerPlayerId("");
            setGoalAssistPlayerId("");
            setGoalTime("");
            await refreshCurrent();
        } finally {
            setAddingGoal(false);
        }
    }

    async function removeGoal(goalId: string) {
        if (!admin || !groupId || !currentMatchId) return;
        if (!goalId) return;

        setRemovingGoal((p) => ({ ...p, [goalId]: true }));
        try {
            await MatchesApi.removeGoal(groupId, currentMatchId, goalId);
            await refreshCurrent();
        } finally {
            setRemovingGoal((p) => ({ ...p, [goalId]: false }));
        }
    }

    // props for steps
    const teamsProps = useMemo(() => {
        return {
            admin,
            onRefresh: refreshCurrent,
            onStart: startMatch,
            canStartNow,

            strategyType,
            setStrategyType,
            includeGoalkeepers,
            setIncludeGoalkeepers,
            playersPerTeam,
            setPlayersPerTeam,
            onGenerateTeams: generateTeams,

            teamColors,
            colorMode,
            setColorMode,
            colorsLocked,
            allowEditColors,
            setAllowEditColors,
            colorsReadOnly,
            teamAColorId,
            setTeamAColorId,
            teamBColorId,
            setTeamBColorId,
            teamAColor,
            teamBColor,
            currentTeamAColorHex: current?.teamAColor?.hexValue ?? "#e2e8f0",
            currentTeamAColorName: current?.teamAColor?.name ?? "—",
            currentTeamBColorHex: current?.teamBColor?.hexValue ?? "#e2e8f0",
            currentTeamBColorName: current?.teamBColor?.name ?? "—",
            onApplyManualColors: applyManualColors,
            onSetColorsRandomDistinct: setColorsRandomDistinct,

            generatedOptions: teamGenOptions,
            selectedTeamGenIdx,
            setSelectedTeamGenIdx,
            allPlayers,
            teamsAlreadyAssigned,
            assigningTeams,
            onAssignTeamsFromGenerated: assignTeamsFromGenerated,

            canSwap: admin && teamsAlreadyAssigned,
            swapA,
            setSwapA,
            swapB,
            setSwapB,
            swapping,
            onSwap: swapPlayers,
            sortedTeamAPlayers,
            sortedTeamBPlayers,
        };
    }, [
        admin,
        refreshCurrent,
        startMatch,
        canStartNow,
        strategyType,
        includeGoalkeepers,
        playersPerTeam,
        teamColors,
        colorMode,
        colorsLocked,
        allowEditColors,
        colorsReadOnly,
        teamAColorId,
        teamBColorId,
        teamAColor,
        teamBColor,
        current?.teamAColor?.hexValue,
        current?.teamAColor?.name,
        current?.teamBColor?.hexValue,
        current?.teamBColor?.name,
        teamGenOptions,
        selectedTeamGenIdx,
        allPlayers,
        teamsAlreadyAssigned,
        assigningTeams,
        swapA,
        swapB,
        swapping,
        sortedTeamAPlayers,
        sortedTeamBPlayers,
    ]);

    const postProps = useMemo(() => {
        return {
            currentMvpName: current?.computedMvp?.playerName ?? "",
            voteCounts: current?.voteCounts ?? [],
            participants,
            scoreA,
            setScoreA,
            scoreB,
            setScoreB,
            settingScore,
            onSetScore: setScore,
            currentScoreA: current?.teamAGoals,
            currentScoreB: current?.teamBGoals,

            voting,
            voteVoterMpId,
            setVoteVoterMpId,
            voteVotedMpId,
            setVoteVotedMpId,
            onVoteMvp: voteMvp,

            goalScorerPlayerId,
            setGoalScorerPlayerId,
            goalAssistPlayerId,
            setGoalAssistPlayerId,
            goalTime,
            setGoalTime,
            addingGoal,
            onAddGoal: addGoal,
            goals: current?.goals ?? [],
            removingGoal,
            onRemoveGoal: removeGoal,
        };
    }, [
        current?.computedMvp?.playerName,
        current?.voteCounts,
        current?.teamAGoals,
        current?.teamBGoals,
        current?.goals,
        participants,
        scoreA,
        scoreB,
        settingScore,
        voting,
        voteVoterMpId,
        voteVotedMpId,
        goalScorerPlayerId,
        goalAssistPlayerId,
        goalTime,
        addingGoal,
        removingGoal,
    ]);

    const currentExistsInCreate = !!current && stepKey === "create";

    return (
        <div className="space-y-6">
            <Section title="Partida">
                {!groupId ? (
                    <div className="muted">Selecione um Group no Dashboard.</div>
                ) : (
                    <MatchWizard
                        admin={admin}
                        stepKey={stepKey}
                        steps={steps}
                        current={current}
                        loading={loading}
                        maxPlayers={maxPlayers}
                        acceptedCount={accepted.length}
                        pendingCount={pending.length}
                        acceptedOverLimit={acceptedOverLimit}
                        placeName={placeName}
                        setPlaceName={setPlaceName}
                        playedAtDate={playedAtDate}
                        setPlayedAtDate={setPlayedAtDate}
                        playedAtTime={playedAtTime}
                        setPlayedAtTime={setPlayedAtTime}
                        canCreateMatch={canCreateMatch}
                        creating={creating}
                        onCreateMatch={createMatch}
                        currentExistsInCreate={currentExistsInCreate}
                        accepted={accepted}
                        rejected={rejected}
                        pending={pending}
                        mutatingInvite={mutatingInvite}
                        activePlayerId={activePlayerId}
                        onAcceptInvite={acceptInvite}
                        onRejectInvite={rejectInvite}
                        onRefresh={refreshCurrent}
                        onGoToMatchMaking={goToMatchMaking}
                        teamsProps={teamsProps}
                        onEndMatch={endMatch}
                        onGoToPostGame={goToPostGame}
                        postProps={postProps}
                        onFinalize={finalizeMatch}
                        onReloadDone={loadList}
                    />
                )}
            </Section>
        </div>
    );
}