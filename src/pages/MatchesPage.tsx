import { useEffect, useMemo, useRef, useState } from "react";
import { Section } from "../components/Section";
import { MatchesApi, TeamColorApi, TeamGenApi, GroupSettingsApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isAdmin, isGroupAdmin } from "../auth/guards";

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
    getMaxPlayers,
    isValidHHmm,
    normalizeTeamGenOptions,
    toDateInputValue,
    toUtcIso,
    uniqById,
} from "../domains/matches/matchUtils";

function mergeCurrent(prev: MatchDetailsDto | null, patch: Partial<MatchDetailsDto>): MatchDetailsDto {
    const base: any = prev ? { ...prev } : {};
    for (const [k, v] of Object.entries(patch)) {
        (base as any)[k] = v;
    }
    return base as MatchDetailsDto;
}

function getIdFromDto(dto: any): string {
    return String(dto?.matchId ?? dto?.id ?? dto?.MatchId ?? dto?.Id ?? "");
}

export default function MatchesPage() {
    const store = useAccountStore();
    const active = store.getActive();
    const groupId = active?.activeGroupId;

    const activePlayerId: string | null = (active as any)?.activePlayerId ?? null;
    const admin = isAdmin() || isGroupAdmin(groupId ?? "");
    const readOnlyUser = !admin;

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

    // ============ STEP ============
    const stepKey: StepKey = useMemo(() => {
        if (!current) return "create";
        const s = Number((current as any)?.status);

        if (s === 0) return "create";
        if (s === 1) return "accept";
        if (s === 2) return "teams";
        if (s === 3) return "playing";
        if (s === 4) return "ended";
        if (s === 5) return "post";
        if (s === 6) return "done";
        return "create";
    }, [current?.status, (current as any)?.matchId]);

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

    // ============ LOADERS (LEVE) ============
    async function loadHeader(matchId: string) {
        if (!groupId || !matchId) return;

        const res = await MatchesApi.header(groupId, matchId);
        const dto = res.data as any;

        // normaliza para o shape do MatchDetailsDto que você já usa
        const patch: Partial<MatchDetailsDto> = {
            matchId: getIdFromDto(dto) || matchId,
            groupId: String(dto?.groupId ?? groupId) as any,
            playedAt: dto?.playedAt ?? dto?.PlayedAt ?? undefined,
            placeName: dto?.placeName ?? dto?.PlaceName ?? "",
            status: Number(dto?.status ?? dto?.Status ?? 0) as any,
            teamAGoals: dto?.teamAGoals ?? dto?.TeamAGoals ?? undefined,
            teamBGoals: dto?.teamBGoals ?? dto?.TeamBGoals ?? undefined,
        } as any;

        setCurrent((prev) => mergeCurrent(prev, patch));
    }

    async function loadAcceptation(matchId: string) {
        if (!groupId || !matchId) return;

        const res = await MatchesApi.acceptation(groupId, matchId);
        const dto = res.data as any;

        const players = (dto?.players ?? dto?.Players ?? []) as PlayerInMatchDto[];

        // aqui você usa unassignedPlayers como pool pra accepted/pending/rejected
        const patch: Partial<MatchDetailsDto> = {
            matchId,
            status: Number(dto?.status ?? dto?.Status ?? 1) as any,
            unassignedPlayers: players as any,
            // pra evitar fallback estranho em outros pontos:
            teamAPlayers: (current?.teamAPlayers ?? []) as any,
            teamBPlayers: (current?.teamBPlayers ?? []) as any,
        } as any;

        setCurrent((prev) => mergeCurrent(prev, patch));
    }

    async function loadMatchMaking(matchId: string) {
        if (!groupId || !matchId) return;

        const res = await MatchesApi.matchmaking(groupId, matchId);
        const dto = res.data as any;

        const patch: Partial<MatchDetailsDto> = {
            matchId,
            status: Number(dto?.status ?? dto?.Status ?? 2) as any,
            teamAColor: dto?.teamAColor ?? dto?.TeamAColor ?? null,
            teamBColor: dto?.teamBColor ?? dto?.TeamBColor ?? null,
            teamAPlayers: (dto?.teamAPlayers ?? dto?.TeamAPlayers ?? []) as any,
            teamBPlayers: (dto?.teamBPlayers ?? dto?.TeamBPlayers ?? []) as any,
            unassignedPlayers: (dto?.unassignedPlayers ?? dto?.UnassignedPlayers ?? []) as any,
        } as any;

        setCurrent((prev) => mergeCurrent(prev, patch));
    }

    async function loadPostGame(matchId: string) {
        if (!groupId || !matchId) return;

        const res = await MatchesApi.postgame(groupId, matchId);
        const dto = res.data as any;

        const patch: Partial<MatchDetailsDto> = {
            matchId,
            status: Number(dto?.status ?? dto?.Status ?? 5) as any,
            teamAGoals: dto?.teamAGoals ?? dto?.TeamAGoals ?? undefined,
            teamBGoals: dto?.teamBGoals ?? dto?.TeamBGoals ?? undefined,
            computedMvp: dto?.computedMvp ?? dto?.ComputedMvp ?? null,
            voteCounts: dto?.voteCounts ?? dto?.VoteCounts ?? [],
            goals: dto?.goals ?? dto?.Goals ?? [],
        } as any;

        setCurrent((prev) => mergeCurrent(prev, patch));
    }

    async function loadStepPayload(matchId: string, step: StepKey) {
        // sempre carrega header (status e dados básicos)
        await loadHeader(matchId);

        // depois carrega apenas o step atual
        if (step === "accept") {
            await loadAcceptation(matchId);
            return;
        }

        if (step === "teams") {
            await loadMatchMaking(matchId);
            return;
        }

        if (step === "post" || step === "done") {
            await loadPostGame(matchId);
            return;
        }

        // playing/ended: por enquanto header basta (se quiser, pode criar endpoints próprios depois)
    }

    async function loadCurrent() {
        if (!groupId) return;

        setLoading(true);
        try {
            const [colorsRes, settingsRes] = await Promise.all([
                TeamColorApi.list(groupId),
                GroupSettingsApi.get(groupId),
            ]);

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

            // ✅ pega a partida em andamento
            try {
                const cur = await MatchesApi.getCurrent(groupId);
                const dto = cur.data as any;

                const id = getIdFromDto(dto);
                if (!id) {
                    setCurrentMatchId(null);
                    setCurrent(null);
                    return;
                }

                setCurrentMatchId(id);

                // inicializa um "current" mínimo logo (pra stepper renderizar rápido)
                setCurrent((prev) =>
                    mergeCurrent(prev, {
                        matchId: id,
                        groupId: groupId as any,
                        status: Number(dto?.status ?? dto?.Status ?? 0) as any,
                        placeName: dto?.placeName ?? dto?.PlaceName ?? prev?.placeName ?? "",
                        playedAt: dto?.playedAt ?? dto?.PlayedAt ?? prev?.playedAt,
                    } as any)
                );

                // carrega payload do step atual (ou create se ainda não tiver status)
                const st = Number(dto?.status ?? dto?.Status ?? 0);
                const sk: StepKey =
                    st === 1 ? "accept" :
                        st === 2 ? "teams" :
                            st === 5 ? "post" :
                                st === 6 ? "done" :
                                    st === 0 ? "create" :
                                        st === 3 ? "playing" :
                                            st === 4 ? "ended" : "create";

                await loadStepPayload(id, sk);
            } catch (e: any) {
                // 404 => sem partida em andamento
                setCurrentMatchId(null);
                setCurrent(null);
            }
        } finally {
            setLoading(false);
        }
    }

    async function refreshCurrent() {
        if (!currentMatchId) return;
        // só recarrega o step atual (não puxa tudo)
        await loadStepPayload(currentMatchId, stepKey);
    }

    async function createMatch() {
        if (!canCreateMatch) return;
        setCreating(true);
        try {
            const playedAt = toUtcIso(playedAtDate, playedAtTime);
            await MatchesApi.create(groupId!, { placeName: placeName.trim(), playedAt } as any);
            await loadCurrent();
        } finally {
            setCreating(false);
        }
    }

    async function rewindOneStep() {
        if (!admin || !groupId || !currentMatchId) return;

        try {
            await MatchesApi.rewind(groupId, currentMatchId);
        } finally {
            await refreshCurrent();
        }
    }

    // ✅ quando o step muda, carregue apenas o payload daquele step
    const lastLoadedStepRef = useRef<StepKey | null>(null);
    useEffect(() => {
        if (!currentMatchId) return;
        if (stepKey === "create") return;

        if (lastLoadedStepRef.current === stepKey) return;
        lastLoadedStepRef.current = stepKey;

        loadStepPayload(currentMatchId, stepKey);
        // eslint-disable-next-line
    }, [currentMatchId, stepKey]);

    // auto load
    useEffect(() => {
        loadCurrent();
        // eslint-disable-next-line
    }, [groupId]);

    // user auto-refresh
    useEffect(() => {
        if (!readOnlyUser) return;
        if (!groupId) return;

        const t = window.setInterval(() => {
            loadCurrent();
        }, 15000);

        return () => window.clearInterval(t);
        // eslint-disable-next-line
    }, [readOnlyUser, groupId]);

    // lock colors when current has them
    useEffect(() => {
        if (!current) return;

        const aId = (current as any)?.teamAColor?.id ?? "";
        const bId = (current as any)?.teamBColor?.id ?? "";
        const alreadySet = !!aId || !!bId;

        if (aId) setTeamAColorId(String(aId));
        if (bId) setTeamBColorId(String(bId));

        setColorsLocked(alreadySet);
        setAllowEditColors(false);
        // eslint-disable-next-line
    }, [(current as any)?.matchId, (current as any)?.teamAColor?.id, (current as any)?.teamBColor?.id]);

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

    const teamAColor = useMemo(
        () => teamColors.find((c) => String(c.id) === String(teamAColorId)) ?? null,
        [teamColors, teamAColorId]
    );
    const teamBColor = useMemo(
        () => teamColors.find((c) => String(c.id) === String(teamBColorId)) ?? null,
        [teamColors, teamBColorId]
    );

    // derived lists
    const allPlayers = useMemo<PlayerInMatchDto[]>(() => buildAllPlayers(current), [current]);

    const invitePool = useMemo<PlayerInMatchDto[]>(() => {
        const list = (current as any)?.unassignedPlayers ?? [];
        return Array.isArray(list) ? list : [];
    }, [current]);

    const accepted = useMemo(
        () => invitePool.filter((p) => Number((p as any).inviteResponse) === InviteResponse.Accepted),
        [invitePool]
    );
    const rejected = useMemo(
        () => invitePool.filter((p) => Number((p as any).inviteResponse) === InviteResponse.Rejected),
        [invitePool]
    );
    const pending = useMemo(
        () => invitePool.filter((p) => Number((p as any).inviteResponse) === InviteResponse.None),
        [invitePool]
    );

    const acceptedOverLimit = accepted.length > maxPlayers;

    const participants = useMemo<PlayerInMatchDto[]>(() => {
        if (!current) return [];

        const a = Array.isArray((current as any)?.teamAPlayers) ? (current as any).teamAPlayers : [];
        const b = Array.isArray((current as any)?.teamBPlayers) ? (current as any).teamBPlayers : [];
        const base = [...a, ...b];

        const fallback = allPlayers.filter((p) => Number((p as any).team) === 1 || Number((p as any).team) === 2);
        const list = base.length ? base : fallback;

        const map = new Map<string, PlayerInMatchDto>();
        for (const p of list) if ((p as any)?.playerId) map.set(String((p as any).playerId), p);
        return Array.from(map.values());
    }, [current, allPlayers]);

    const teamsAlreadyAssigned = useMemo(() => {
        const a = (current as any)?.teamAPlayers?.length ?? 0;
        const b = (current as any)?.teamBPlayers?.length ?? 0;
        return a > 0 && b > 0;
    }, [(current as any)?.teamAPlayers, (current as any)?.teamBPlayers]);

    const sortedTeamAPlayers = useMemo(() => {
        const a = Array.isArray((current as any)?.teamAPlayers) ? (current as any).teamAPlayers : [];
        return [...a].sort((x: any, y: any) => Number(y.isGoalkeeper) - Number(x.isGoalkeeper));
    }, [(current as any)?.teamAPlayers]);

    const sortedTeamBPlayers = useMemo(() => {
        const b = Array.isArray((current as any)?.teamBPlayers) ? (current as any).teamBPlayers : [];
        return [...b].sort((x: any, y: any) => Number(y.isGoalkeeper) - Number(x.isGoalkeeper));
    }, [(current as any)?.teamBPlayers]);

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
            await loadCurrent();
        } finally {
            setFinalizing(false);
        }
    }

    // matchmaking: teamgen + assign + colors + swap
    async function generateTeams() {
        if (!groupId || !current) return;

        const acceptedAll = allPlayers.filter((p) => Number((p as any).inviteResponse) === InviteResponse.Accepted);

        const players: TeamGenPlayerDto[] = uniqById(
            acceptedAll
                .filter((p) => typeof (p as any).playerId === "string" && String((p as any).playerId).trim().length > 0)
                .map((p) => ({
                    id: String((p as any).playerId),
                    name: (p as any).playerName ?? "—",
                    isGoalkeeper: !!(p as any).isGoalkeeper,
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

        const opt = teamGenOptions[Math.max(0, Math.min(selectedTeamGenIdx, teamGenOptions.length - 1))] as any;
        const teamAPlayerIds = Array.isArray(opt.teamA) ? opt.teamA.map((x: any) => x.playerId) : [];
        const teamBPlayerIds = Array.isArray(opt.teamB) ? opt.teamB.map((x: any) => x.playerId) : [];
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

    const canStartNow = useMemo(
        () => admin && stepKey === "teams" && teamsAlreadyAssigned,
        [admin, stepKey, teamsAlreadyAssigned]
    );

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
            currentTeamAColorHex: (current as any)?.teamAColor?.hexValue ?? "#e2e8f0",
            currentTeamAColorName: (current as any)?.teamAColor?.name ?? "—",
            currentTeamBColorHex: (current as any)?.teamBColor?.hexValue ?? "#e2e8f0",
            currentTeamBColorName: (current as any)?.teamBColor?.name ?? "—",
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
        (current as any)?.teamAColor?.hexValue,
        (current as any)?.teamAColor?.name,
        (current as any)?.teamBColor?.hexValue,
        (current as any)?.teamBColor?.name,
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
            currentMvpName: (current as any)?.computedMvp?.playerName ?? "",
            voteCounts: (current as any)?.voteCounts ?? [],
            participants,
            scoreA,
            setScoreA,
            scoreB,
            setScoreB,
            settingScore,
            onSetScore: setScore,
            currentScoreA: (current as any)?.teamAGoals,
            currentScoreB: (current as any)?.teamBGoals,

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
            goals: (current as any)?.goals ?? [],
            removingGoal,
            onRemoveGoal: removeGoal,
        };
    }, [
        (current as any)?.computedMvp?.playerName,
        (current as any)?.voteCounts,
        (current as any)?.teamAGoals,
        (current as any)?.teamBGoals,
        (current as any)?.goals,
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

    const canRewind = useMemo(() => {
        if (!admin) return false;
        if (!current) return false;
        const s = Number((current as any).status);
        return Number.isFinite(s) && s > 0; // > Created
    }, [admin, (current as any)?.status]);

    return (
        <div className="space-y-6">
            <Section title="Partida">
                {!groupId ? (
                    <div className="muted">Selecione um Group no Dashboard.</div>
                ) : (
                    <div className="space-y-3">
                        {admin && currentMatchId && (
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    className={[
                                        "px-3 py-2 rounded-xl border text-sm",
                                        canRewind
                                            ? "bg-white hover:bg-slate-50 border-slate-200"
                                            : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed",
                                    ].join(" ")}
                                    onClick={() => {
                                        if (!canRewind) return;
                                        rewindOneStep();
                                    }}
                                    disabled={!canRewind}
                                    title={canRewind ? "Voltar uma etapa" : "Não é possível voltar neste status"}
                                >
                                    Voltar etapa
                                </button>
                            </div>
                        )}

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
                            onReloadDone={loadCurrent}
                            finalizing={finalizing as any}
                        />
                    </div>
                )}
            </Section>
        </div>
    );
}