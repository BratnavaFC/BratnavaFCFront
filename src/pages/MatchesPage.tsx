import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { AddGuestModal } from "../components/modals/AddGuestModal";
import ModalBackdrop from "../components/modals/ModalBackdrop";
import { MatchesApi, TeamColorApi, TeamGenApi, GroupSettingsApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isGodMode } from "../auth/guards";
import { getResponseMessage } from "../api/apiResponse";

import { MatchWizard } from "../domains/matches/steps/MatchWizard";
import type {
    ColorMode,
    GroupSettingsDto,
    MatchDetailsDto,
    MatchHeaderDto,
    PlayerInMatchDto,
    StrategyId,
    TeamColorDto,
    TeamGenPlayerDto,
    TeamOptionDto,
    PlayerWeightDto,
    StepKey,
} from "../domains/matches/matchTypes";
import { InviteResponse, MATCH_CONSTANTS } from "../domains/matches/matchTypes";
import {
    buildAllPlayers,
    getMaxPlayers,
    isValidHHmm,
    normalizeTeamGenOptions,
    toDateInputValue,
    toUtcIso,
    uniqById,
} from "../domains/matches/matchUtils";

/** How often non-admin users poll for match status updates (ms). */
const NON_ADMIN_POLL_INTERVAL_MS = 15_000;

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
    const store    = useAccountStore();
    const active   = store.getActive();
    const groupId  = active?.activeGroupId;
    const [searchParams, setSearchParams] = useSearchParams();

    const activePlayerId: string | null = (active as any)?.activePlayerId ?? null;
    const admin       = isGodMode() || !!(groupId && active?.groupAdminIds?.includes(groupId));
    const readOnlyUser = !admin;

    // ── Multi-match state ─────────────────────────────────────────────────────
    const [upcomingMatches, setUpcomingMatches] = useState<MatchHeaderDto[]>([]);
    const [selectedIdx,     setSelectedIdx]     = useState(0);
    const [creatingNew,     setCreatingNew]     = useState(false);

    // Derived — used throughout all handlers (same variable name kept for minimal churn)
    const selectedMatch  = upcomingMatches[selectedIdx] ?? null;
    const currentMatchId = creatingNew ? null : (selectedMatch?.matchId ?? null);

    const [current, setCurrent] = useState<MatchDetailsDto | null>(null);
    const [godPreview, setGodPreview] = useState<StepKey | null>(null);
    const [addGuestOpen, setAddGuestOpen] = useState(false);

    const [teamColors, setTeamColors] = useState<TeamColorDto[]>([]);
    const [groupSettings, setGroupSettings] = useState<GroupSettingsDto | null>(null);

    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleting,          setDeleting]          = useState(false);

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

    // post-game
    const [settingScore, setSettingScore] = useState(false);
    const [scoreA, setScoreA] = useState<string>("");
    const [scoreB, setScoreB] = useState<string>("");

    const [voting, setVoting] = useState(false);
    const [voteVoterMpId, setVoteVoterMpId] = useState<string>("");
    const [voteVotedMpId, setVoteVotedMpId] = useState<string>("");

    const [addingGoal, setAddingGoal] = useState(false);

    const [removingGoal, setRemovingGoal] = useState<Record<string, boolean>>({});
    const [finalizing, setFinalizing] = useState(false);

    const [teamGenOptions, setTeamGenOptions] = useState<TeamOptionDto[] | null>(null);
    const [selectedTeamGenIdx, setSelectedTeamGenIdx] = useState<number>(0);

    const maxPlayers = (current as any)?.maxPlayers || getMaxPlayers(groupSettings);

    const placeNameOk = placeName.trim().length > 0;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(playedAtDate);
    const timeOk = isValidHHmm(playedAtTime);
    const canCreateMatch = admin && !!groupId && placeNameOk && dateOk && timeOk && !creating
        && upcomingMatches.length < MATCH_CONSTANTS.maxSimultaneous;

    // ============ STEP ============
    const stepKey: StepKey = creatingNew
        ? "create"
        : (((current as any)?.stepKey as StepKey) ?? (selectedMatch?.stepKey as StepKey) ?? "create");

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
        try {
            const res = await MatchesApi.header(groupId, matchId);
            const dto = res.data.data as any;

            // normaliza para o shape do MatchDetailsDto que você já usa
            const patch: Partial<MatchDetailsDto> = {
                matchId: getIdFromDto(dto) || matchId,
                groupId: String(dto?.groupId ?? groupId) as any,
                playedAt: dto?.playedAt ?? dto?.PlayedAt ?? undefined,
                placeName: dto?.placeName ?? dto?.PlaceName ?? "",
                status: Number(dto?.status ?? dto?.Status ?? 0) as any,
                stepKey: dto?.stepKey ?? dto?.StepKey ?? "create",
                canRewind: dto?.canRewind ?? dto?.CanRewind ?? false,
                teamAGoals: dto?.teamAGoals ?? dto?.TeamAGoals ?? undefined,
                teamBGoals: dto?.teamBGoals ?? dto?.TeamBGoals ?? undefined,
                linkedPollId: dto?.linkedPollId ?? dto?.LinkedPollId ?? null,
            } as any;

            setCurrent((prev) => mergeCurrent(prev, patch));
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar partida."));
        }
    }

    async function loadAcceptation(matchId: string) {
        if (!groupId || !matchId) return;
        try {
            const res = await MatchesApi.acceptation(groupId, matchId);
            const dto = res.data.data as any;

            const patch: Partial<MatchDetailsDto> = {
                matchId,
                status: Number(dto?.status ?? dto?.Status ?? 1) as any,
                acceptedPlayers: dto?.acceptedPlayers ?? dto?.AcceptedPlayers ?? [],
                rejectedPlayers: dto?.rejectedPlayers ?? dto?.RejectedPlayers ?? [],
                pendingPlayers:  dto?.pendingPlayers  ?? dto?.PendingPlayers  ?? [],
                maxPlayers:      dto?.maxPlayers      ?? dto?.MaxPlayers      ?? 0,
                acceptedOverLimit: dto?.acceptedOverLimit ?? dto?.AcceptedOverLimit ?? false,
                teamAPlayers: (current?.teamAPlayers ?? []) as any,
                teamBPlayers: (current?.teamBPlayers ?? []) as any,
            } as any;

            setCurrent((prev) => mergeCurrent(prev, patch));
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar confirmações."));
        }
    }

    async function loadMatchMaking(matchId: string) {
        if (!groupId || !matchId) return;
        try {
            const res = await MatchesApi.matchmaking(groupId, matchId);
            const dto = res.data.data as any;

            const patch: Partial<MatchDetailsDto> = {
                matchId,
                status: Number(dto?.status ?? dto?.Status ?? 2) as any,
                teamAColor: dto?.teamAColor ?? dto?.TeamAColor ?? null,
                teamBColor: dto?.teamBColor ?? dto?.TeamBColor ?? null,
                teamAPlayers: (dto?.teamAPlayers ?? dto?.TeamAPlayers ?? []) as any,
                teamBPlayers: (dto?.teamBPlayers ?? dto?.TeamBPlayers ?? []) as any,
                unassignedPlayers: (dto?.unassignedPlayers ?? dto?.UnassignedPlayers ?? []) as any,
                participants: (dto?.participants ?? dto?.Participants ?? []) as any,
                colorsLocked: dto?.colorsLocked ?? dto?.ColorsLocked ?? false,
            } as any;

            setCurrent((prev) => mergeCurrent(prev, patch));
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar times."));
        }
    }

    async function loadPostGame(matchId: string) {
        if (!groupId || !matchId) return;
        try {
            const res = await MatchesApi.postgame(groupId, matchId);
            const dto = res.data.data as any;

            const patch: Partial<MatchDetailsDto> = {
                matchId,
                status: Number(dto?.status ?? dto?.Status ?? 5) as any,
                teamAGoals: dto?.teamAGoals ?? dto?.TeamAGoals ?? undefined,
                teamBGoals: dto?.teamBGoals ?? dto?.TeamBGoals ?? undefined,
                computedMvps: (dto?.computedMvps ?? dto?.ComputedMvps ?? []) as any,
                votes: (dto?.votes ?? dto?.Votes ?? []) as any,
                voteCounts: dto?.voteCounts ?? dto?.VoteCounts ?? [],
                goals: dto?.goals ?? dto?.Goals ?? [],
                allVoted: dto?.allVoted ?? dto?.AllVoted ?? false,
                eligibleVoters: dto?.eligibleVoters ?? dto?.EligibleVoters ?? [],
                participants: (dto?.participants ?? dto?.Participants ?? []) as any,
            } as any;

            setCurrent((prev) => mergeCurrent(prev, patch));
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar pós-jogo."));
        }
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

        if (step === "post") {
            await loadPostGame(matchId);
            return;
        }

        if (step === "done") {
            await loadPostGame(matchId);
            return;
        }

        if (step === "playing") {
            // participants vêm do matchmaking; goals e linkedPollId do details
            await loadMatchMaking(matchId);
            const detailsRes = await MatchesApi.details(groupId!, matchId).catch(() => ({ data: null }));
            const dDto = (detailsRes as any)?.data?.data as any;
            const goals        = (dDto?.goals ?? dDto?.Goals ?? []) as any[];
            const linkedPollId = dDto?.linkedPollId ?? dDto?.LinkedPollId ?? null;
            setCurrent((prev) => mergeCurrent(prev, { goals, linkedPollId } as any));
            return;
        }

        // ended: header basta
    }

    /**
     * Loads all upcoming (non-finalized) matches and the full step payload for the
     * selected one. Pass `selectMatchId` to force-select a specific match after the
     * list refreshes (e.g. right after creating a new match).
     */
    async function loadUpcoming(selectMatchId?: string) {
        if (!groupId) return;

        setLoading(true);
        try {
            // ── 1. Colors (critical) ──────────────────────────────────────────
            const colorsRes = await TeamColorApi.list(groupId, true).catch(() => ({ data: { data: [] } }));
            setTeamColors((colorsRes.data.data ?? []) as TeamColorDto[]);

            // ── 2. Group settings (non-critical) ─────────────────────────────
            try {
                const settingsRes = await GroupSettingsApi.get(groupId);
                const gs = (settingsRes.data.data ?? null) as GroupSettingsDto | null;
                setGroupSettings(gs);
                if (gs) {
                    // TimeSpan comes as "HH:mm:ss" — keep first 5 chars → "HH:mm"
                    setPlaceName((prev) => prev.trim().length ? prev : gs.defaultPlaceName ?? gs.placeName ?? "");
                    setPlayedAtTime((prev) => prev.trim().length ? prev : gs.defaultKickoffTime?.slice(0, 5) ?? "");
                }
            } catch {
                // GroupSettings not configured — form fields stay editable
            }

            // ── 3. Upcoming matches ───────────────────────────────────────────
            const upcomingRes = await MatchesApi.upcoming(groupId);
            const list = (upcomingRes.data.data ?? []) as MatchHeaderDto[];
            setUpcomingMatches(list);
            setCreatingNew(false);

            if (list.length === 0) {
                setSelectedIdx(0);
                setCurrent(null);
                return;
            }

            // ── 4. Determine which match to show ──────────────────────────────
            // Priority: explicit selectMatchId arg → URL param → keep current idx
            const matchIdToSelect = selectMatchId ?? searchParams.get("match") ?? null;
            const idxFromArg = matchIdToSelect
                ? list.findIndex((m) => m.matchId === matchIdToSelect)
                : -1;

            const targetIdx = idxFromArg >= 0
                ? idxFromArg
                : Math.min(selectedIdx, list.length - 1);

            setSelectedIdx(targetIdx);
            lastSelectedMatchRef.current = list[targetIdx].matchId;

            // ── 5. Load step payload for selected match ───────────────────────
            await loadStepPayload(list[targetIdx].matchId, list[targetIdx].stepKey as StepKey);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar partidas."));
        } finally {
            setLoading(false);
        }
    }

    async function refreshCurrent() {
        if (!currentMatchId) return;
        // Only reloads the payload for the current step (lightweight)
        await loadStepPayload(currentMatchId, stepKey);
    }

    /** Switches to a different match by list index, loading its step payload. */
    async function selectMatch(idx: number) {
        const match = upcomingMatches[idx];
        if (!match) return;
        if (match.matchId === currentMatchId) return; // already selected

        setSelectedIdx(idx);
        setCurrent(null);
        lastLoadedStepRef.current   = null;
        lastSelectedMatchRef.current = match.matchId;
        setSearchParams(match.matchId ? { match: match.matchId } : {}, { replace: true });
        await loadStepPayload(match.matchId, match.stepKey as StepKey);
    }

    async function createMatch() {
        if (!canCreateMatch) return;
        setCreating(true);
        try {
            const playedAt = toUtcIso(playedAtDate, playedAtTime);
            const res = await MatchesApi.create(groupId!, { placeName: placeName.trim(), playedAt } as any);
            // Auto-select the newly created match by ID
            const newMatchId = getIdFromDto((res.data as any)?.data ?? (res as any)?.data);
            await loadUpcoming(newMatchId || undefined);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao criar partida."));
        } finally {
            setCreating(false);
        }
    }

    async function rewindOneStep() {
        if (!admin || !groupId || !currentMatchId) return;

        try {
            await MatchesApi.rewind(groupId, currentMatchId);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao voltar etapa."));
        } finally {
            await refreshCurrent();
        }
    }

    // Tracks the last loaded step and match to avoid redundant fetches
    const lastLoadedStepRef    = useRef<StepKey | null>(null);
    const lastSelectedMatchRef = useRef<string | null>(null);

    // When the step or the selected match changes, load the new step payload once
    useEffect(() => {
        if (!currentMatchId || stepKey === "create") return;

        const matchChanged = lastSelectedMatchRef.current !== currentMatchId;
        const stepChanged  = lastLoadedStepRef.current   !== stepKey;
        if (!matchChanged && !stepChanged) return;

        lastSelectedMatchRef.current = currentMatchId;
        lastLoadedStepRef.current    = stepKey;
        loadStepPayload(currentMatchId, stepKey);
        // eslint-disable-next-line
    }, [currentMatchId, stepKey]);

    // Reset god preview when real step changes
    useEffect(() => { setGodPreview(null); }, [stepKey]);

    async function handleGodStepClick(key: string) {
        const k = key as StepKey;
        setGodPreview(k);
        if (currentMatchId) await loadStepPayload(currentMatchId, k);
    }

    const displayStepKey: StepKey = creatingNew
        ? "create"
        : ((isGodMode() && godPreview) ? godPreview : stepKey);

    // Initial load
    useEffect(() => {
        loadUpcoming();
        // eslint-disable-next-line
    }, [groupId]);

    // Sync URL param when selected match changes (skip on first render when URL may already be set)
    useEffect(() => {
        if (!currentMatchId) {
            setSearchParams({}, { replace: true });
        } else {
            setSearchParams({ match: currentMatchId }, { replace: true });
        }
        // eslint-disable-next-line
    }, [currentMatchId]);

    // Non-admin auto-refresh: poll the full upcoming list so users see status advances
    useEffect(() => {
        if (!readOnlyUser || !groupId) return;
        const intervalId = window.setInterval(() => { loadUpcoming(); }, NON_ADMIN_POLL_INTERVAL_MS);
        return () => window.clearInterval(intervalId);
        // eslint-disable-next-line
    }, [readOnlyUser, groupId]);

    // sync color state when match data loads
    useEffect(() => {
        if (!current) return;

        const aId = (current as any)?.teamAColor?.id ?? "";
        const bId = (current as any)?.teamBColor?.id ?? "";

        if (aId) setTeamAColorId(String(aId));
        if (bId) setTeamBColorId(String(bId));

        setColorsLocked((current as any)?.colorsLocked ?? (!!aId || !!bId));
        setAllowEditColors(false);
        // eslint-disable-next-line
    }, [(current as any)?.matchId, (current as any)?.teamAColor?.id, (current as any)?.teamBColor?.id, (current as any)?.colorsLocked]);

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

    // derived lists — computed by backend
    const allPlayers = useMemo<PlayerInMatchDto[]>(() => buildAllPlayers(current), [current]);

    const accepted: PlayerInMatchDto[] = (current as any)?.acceptedPlayers ?? [];
    const rejected: PlayerInMatchDto[] = (current as any)?.rejectedPlayers ?? [];
    const pending: PlayerInMatchDto[]  = (current as any)?.pendingPlayers  ?? [];

    const acceptedOverLimit: boolean = (current as any)?.acceptedOverLimit ?? false;

    const participants: PlayerInMatchDto[] = (current as any)?.participants ?? [];

    const teamsAlreadyAssigned = useMemo(() => {
        const a = (current as any)?.teamAPlayers?.length ?? 0;
        const b = (current as any)?.teamBPlayers?.length ?? 0;
        return a > 0 && b > 0;
    }, [(current as any)?.teamAPlayers, (current as any)?.teamBPlayers]);

    // Backend returns players already sorted (goalkeeper first, then name)
    const sortedTeamAPlayers: PlayerInMatchDto[] = (current as any)?.teamAPlayers ?? [];
    const sortedTeamBPlayers: PlayerInMatchDto[] = (current as any)?.teamBPlayers ?? [];

    // Non-admin: automatically use own matchPlayerId as the voter (from eligible list)
    useEffect(() => {
        if (admin || !activePlayerId) return;
        const eligible: any[] = (current as any)?.eligibleVoters ?? [];
        const myMpId = eligible.find((p: any) => p.playerId === activePlayerId)?.matchPlayerId;
        if (myMpId) setVoteVoterMpId(myMpId);
        // eslint-disable-next-line
    }, [admin, (current as any)?.eligibleVoters, activePlayerId]);

    // actions
    async function acceptInvite(playerId: string) {
        if (!groupId || !currentMatchId) return;

        setMutatingInvite((prev) => ({ ...prev, [playerId]: true }));
        try {
            await MatchesApi.accept(groupId, currentMatchId, { playerId } as any);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao aceitar convite."));
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
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao recusar convite."));
        } finally {
            setMutatingInvite((prev) => ({ ...prev, [playerId]: false }));
        }
    }

    async function goToMatchMaking() {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.goToMatchMaking(groupId, currentMatchId);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao avançar para matchmaking."));
        }
    }

    async function addGuestToMatch(name: string, isGoalkeeper: boolean, starRating: number | null) {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.addGuest(groupId, currentMatchId, {
                name,
                isGoalkeeper,
                guestStarRating: starRating ?? undefined,
            });
            await loadAcceptation(currentMatchId);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao adicionar convidado."));
        }
    }

    async function startMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.start(groupId, currentMatchId);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao iniciar partida."));
        }
    }

    async function endMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.end(groupId, currentMatchId);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao encerrar partida."));
        }
    }

    async function goToPostGame() {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.goToPostGame(groupId, currentMatchId);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao ir para pós-jogo."));
        }
    }

    async function finalizeMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        setFinalizing(true);
        try {
            await MatchesApi.finalize(groupId, currentMatchId);
            // Finalized match leaves the upcoming list — refresh to pick the next one
            await loadUpcoming();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao finalizar partida."));
        } finally {
            setFinalizing(false);
        }
    }

    // matchmaking: teamgen + assign + colors + swap
    async function generateTeams() {
        if (!groupId || !current) return;

        const players: TeamGenPlayerDto[] = uniqById(
            allPlayers
                .filter((p) =>
                    typeof (p as any).playerId === "string" &&
                    String((p as any).playerId).trim().length > 0 &&
                    Number((p as any).inviteResponse) === InviteResponse.Accepted
                )
                .map((p) => ({
                    id: String((p as any).playerId),
                    name: (p as any).playerName ?? "—",
                    isGoalkeeper: !!(p as any).isGoalkeeper,
                }))
        );

        if (players.length < 2) return;

        const req = { players, strategyType, playersPerTeam, includeGoalkeepers, optionsCount: 3 };
        try {
            const res = await TeamGenApi.generate(req as any);
            const options = normalizeTeamGenOptions(res.data.data);
            setTeamGenOptions(options);
            setSelectedTeamGenIdx(0);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao gerar times."));
        }
    }

    async function setColorsRandomDistinct() {
        if (!groupId || !currentMatchId) return;

        const colors = (teamColors ?? []).filter((c) => c?.id);
        if (colors.length < 2) return;

        const shuffled = [...colors].sort(() => Math.random() - 0.5);
        const a = shuffled[0];
        const b = shuffled.find((x) => x.id !== a.id) ?? shuffled[1];

        try {
            await MatchesApi.setColors(groupId, currentMatchId, { teamAColorId: a.id, teamBColorId: b.id } as any);
            setTeamAColorId(String(a.id));
            setTeamBColorId(String(b.id));
            setColorMode("manual");
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao definir cores."));
        }
    }

    async function applyManualColors() {
        if (!groupId || !currentMatchId) return;
        if (!teamAColorId || !teamBColorId) return;
        try {
            await MatchesApi.setColors(groupId, currentMatchId, { teamAColorId, teamBColorId } as any);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao aplicar cores."));
        }
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

            setTeamGenOptions(null);
            setSelectedTeamGenIdx(0);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao atribuir times."));
        } finally {
            setAssigningTeams(false);
        }
    }

    async function swapPlayers(playerAId: string, playerBId: string) {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.swap(groupId, currentMatchId, { playerAId, playerBId } as any);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao trocar jogadores."));
        }
    }

    async function setPlayerRole(matchPlayerId: string, isGoalkeeper: boolean) {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.setPlayerRole(groupId, currentMatchId, matchPlayerId, { isGoalkeeper });
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao alterar função do jogador."));
        }
    }

    async function setNoShow(matchPlayerId: string, didNotPlay: boolean) {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.setNoShow(groupId, currentMatchId, matchPlayerId, didNotPlay);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao marcar ausência."));
        }
    }

    /** Move a single assigned player from their current team to the other team. */
    async function movePlayerToOtherTeam(playerId: string, fromTeam: "A" | "B") {
        if (!admin || !groupId || !currentMatchId) return;
        const currentA = sortedTeamAPlayers.map((p: any) => p.playerId as string);
        const currentB = sortedTeamBPlayers.map((p: any) => p.playerId as string);
        const newA =
            fromTeam === "A"
                ? currentA.filter((id) => id !== playerId)
                : [...currentA, playerId];
        const newB =
            fromTeam === "B"
                ? currentB.filter((id) => id !== playerId)
                : [...currentB, playerId];
        setAssigningTeams(true);
        try {
            await MatchesApi.assignTeams(groupId, currentMatchId, {
                TeamAMatchPlayerIds: newA,
                TeamBMatchPlayerIds: newB,
            } as any);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao mover jogador."));
        } finally {
            setAssigningTeams(false);
        }
    }

    /** Recalculates dimension diffs (attack/defense/physical) from per-player rating norms. */
    function calcDimDiffs(a: PlayerWeightDto[], b: PlayerWeightDto[]) {
        const sum = (arr: PlayerWeightDto[], key: keyof PlayerWeightDto) =>
            arr.reduce((s, p) => s + ((p[key] as number | null | undefined) ?? 0), 0);
        return {
            attackDiff:   Math.abs(sum(a, "attackRatingNorm")   - sum(b, "attackRatingNorm")),
            defenseDiff:  Math.abs(sum(a, "defenseRatingNorm")  - sum(b, "defenseRatingNorm")),
            physicalDiff: Math.abs(sum(a, "physicalRatingNorm") - sum(b, "physicalRatingNorm")),
        };
    }

    /** Move a player between unassigned/teamA/teamB within the generated carousel (local state only). */
    function movePlayerInGeneratedOption(playerId: string, targetTeam: "A" | "B") {
        if (!teamGenOptions) return;
        const safeIdx = Math.max(0, Math.min(selectedTeamGenIdx, teamGenOptions.length - 1));
        const opt = teamGenOptions[safeIdx];
        if (!opt) return;

        const all = [...(opt.unassigned ?? []), ...(opt.teamA ?? []), ...(opt.teamB ?? [])];
        const player = all.find((p) => p.playerId === playerId);
        if (!player) return;

        const unassigned = (opt.unassigned ?? []).filter((p) => p.playerId !== playerId);
        const baseA = (opt.teamA ?? []).filter((p) => p.playerId !== playerId);
        const baseB = (opt.teamB ?? []).filter((p) => p.playerId !== playerId);
        const newA = targetTeam === "A" ? [...baseA, player] : baseA;
        const newB = targetTeam === "B" ? [...baseB, player] : baseB;

        // Recalculate balance metrics
        const newAWeight = newA.reduce((s, p) => s + p.weight, 0);
        const newBWeight = newB.reduce((s, p) => s + p.weight, 0);
        const total = newAWeight + newBWeight;
        const balanceDiff = total > 0 ? Math.abs(newAWeight - newBWeight) / total : 0;

        const updatedOpt: TeamOptionDto = {
            ...opt,
            unassigned,
            teamA: newA,
            teamB: newB,
            teamAWeight: newAWeight,
            teamBWeight: newBWeight,
            balanceDiff,
            ...calcDimDiffs(newA, newB),
        };
        setTeamGenOptions((prev) => prev?.map((o, i) => (i === safeIdx ? updatedOpt : o)) ?? prev);
    }

    /** Swap two players (one from each team) within the generated carousel (local state only). */
    function swapInGeneratedOption(playerAId: string, playerBId: string) {
        if (!teamGenOptions) return;
        const safeIdx = Math.max(0, Math.min(selectedTeamGenIdx, teamGenOptions.length - 1));
        const opt = teamGenOptions[safeIdx];
        if (!opt) return;

        const pA = [...opt.teamA, ...opt.teamB].find((p) => p.playerId === playerAId);
        const pB = [...opt.teamA, ...opt.teamB].find((p) => p.playerId === playerBId);
        if (!pA || !pB) return;

        const aInTeamA = opt.teamA.some((p) => p.playerId === playerAId);
        const bInTeamA = opt.teamA.some((p) => p.playerId === playerBId);
        if (aInTeamA === bInTeamA) return; // same team — nothing to swap

        const baseA = opt.teamA.filter((p) => p.playerId !== playerAId && p.playerId !== playerBId);
        const baseB = opt.teamB.filter((p) => p.playerId !== playerAId && p.playerId !== playerBId);
        // pA came from teamA → goes to teamB; pB came from teamB → goes to teamA  (and vice-versa)
        const newA = aInTeamA ? [...baseA, pB] : [...baseA, pA];
        const newB = aInTeamA ? [...baseB, pA] : [...baseB, pB];

        const newAWeight = newA.reduce((s, p) => s + p.weight, 0);
        const newBWeight = newB.reduce((s, p) => s + p.weight, 0);
        const total = newAWeight + newBWeight;
        const balanceDiff = total > 0 ? Math.abs(newAWeight - newBWeight) / total : 0;

        const updatedOpt: TeamOptionDto = {
            ...opt,
            teamA: newA,
            teamB: newB,
            teamAWeight: newAWeight,
            teamBWeight: newBWeight,
            balanceDiff,
            ...calcDimDiffs(newA, newB),
        };
        setTeamGenOptions((prev) => prev?.map((o, i) => (i === safeIdx ? updatedOpt : o)) ?? prev);
    }

    /** Assign an unassigned player (team===0) to a team after teams have already been set. */
    async function assignUnassigned(playerId: string, team: "A" | "B") {
        if (!admin || !groupId || !currentMatchId) return;
        const currentA = sortedTeamAPlayers.map((p: any) => p.playerId as string);
        const currentB = sortedTeamBPlayers.map((p: any) => p.playerId as string);
        const newA = team === "A" ? [...currentA, playerId] : currentA;
        const newB = team === "B" ? [...currentB, playerId] : currentB;

        setAssigningTeams(true);
        try {
            await MatchesApi.assignTeams(groupId, currentMatchId, {
                TeamAMatchPlayerIds: newA,
                TeamBMatchPlayerIds: newB,
            } as any);
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao atribuir jogador."));
        } finally {
            setAssigningTeams(false);
        }
    }

    const canStartNow = useMemo(
        () => admin && stepKey === "teams" && teamsAlreadyAssigned,
        [admin, stepKey, teamsAlreadyAssigned]
    );

    // ── edit / delete match ───────────────────────────────────────────────────
    async function editMatch(playedAt: string, placeName: string) {
        if (!groupId || !currentMatchId) return;
        try {
            await MatchesApi.update(groupId, currentMatchId, { playedAt, placeName });
            await refreshCurrent();
            toast.success("Partida atualizada.");
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao atualizar a partida."));
        }
    }

    async function deleteMatch() {
        if (!admin || !groupId || !currentMatchId) return;
        setDeleting(true);
        try {
            await MatchesApi.remove(groupId, currentMatchId);
            toast.success("Partida excluída.");
            setConfirmDeleteOpen(false);
            const sibling = upcomingMatches.find(m => m.matchId !== currentMatchId);
            await loadUpcoming(sibling?.matchId);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao excluir partida."));
        } finally {
            setDeleting(false);
        }
    }

    async function reapplyMvp() {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.reapplyMvp(groupId, currentMatchId);
            await refreshCurrent();
            toast.success("MVP recalculado com sucesso.");
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao recalcular MVP."));
        }
    }

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
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao registrar placar."));
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
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao registrar voto."));
        } finally {
            setVoting(false);
        }
    }

    async function addGoal(scorerPlayerId: string, assistPlayerId: string | null, time: string, isOwnGoal = false) {
        if (!groupId || !currentMatchId) return;
        if (!scorerPlayerId || !time.trim()) return;

        setAddingGoal(true);
        try {
            await MatchesApi.addGoal(groupId, currentMatchId, {
                scorerPlayerId,
                assistPlayerId: assistPlayerId?.trim() ? assistPlayerId : null,
                time: time.trim(),
                isOwnGoal,
            } as any);

            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao adicionar gol."));
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
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao remover gol."));
        } finally {
            setRemovingGoal((p) => ({ ...p, [goalId]: false }));
        }
    }

    async function editGoal(goalId: string, scorerPlayerId: string, assistPlayerId: string | null, time: string, isOwnGoal: boolean) {
        if (!admin || !groupId || !currentMatchId) return;
        try {
            await MatchesApi.updateGoal(groupId, currentMatchId, goalId, { scorerPlayerId, assistPlayerId, time: time || null, isOwnGoal });
            await refreshCurrent();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao editar gol."));
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

            sortedTeamAPlayers,
            sortedTeamBPlayers,
            onSwapPlayers: swapPlayers,
            onMovePlayerToOtherTeam: movePlayerToOtherTeam,
            onMovePlayerToTeam: movePlayerInGeneratedOption,
            onSwapInOption: swapInGeneratedOption,
            onAssignUnassigned: assignUnassigned,
            onSetPlayerRole: setPlayerRole,
            onSetNoShow: setNoShow,
            matchPlayedAt: (current as any)?.playedAt ?? '',
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
        (current as any)?.playedAt,
        teamGenOptions,
        selectedTeamGenIdx,
        allPlayers,
        teamsAlreadyAssigned,
        assigningTeams,
        sortedTeamAPlayers,
        sortedTeamBPlayers,
        setPlayerRole,
    ]);

    const postProps = useMemo(() => {
        return {
            currentMvpNames: ((current as any)?.computedMvps ?? []).map((m: any) => m.playerName ?? m.PlayerName ?? "").filter(Boolean) as string[],
            votes: (current as any)?.votes ?? [],
            voteCounts: (current as any)?.voteCounts ?? [],
            allVoted: (current as any)?.allVoted ?? false,
            eligibleVoters: (current as any)?.eligibleVoters ?? [],
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

            addingGoal,
            onAddGoal: addGoal,
            goals: (current as any)?.goals ?? [],
            removingGoal,
            onRemoveGoal: removeGoal,
            onEditGoal: editGoal,
            activeMatchPlayerId:
                participants.find((p) => p.playerId === activePlayerId)?.matchPlayerId ?? "",

            teamAName: (current as any)?.teamAColor?.name ?? "Time A",
            teamAHex:  (current as any)?.teamAColor?.hexValue ?? "",
            teamBName: (current as any)?.teamBColor?.name ?? "Time B",
            teamBHex:  (current as any)?.teamBColor?.hexValue ?? "",

            paymentMode: (groupSettings as any)?.paymentMode ?? 0,
            groupId: groupId ?? undefined,
            matchId: currentMatchId ?? undefined,
            matchDate: (current as any)?.playedAt ?? undefined,
            placeName: (current as any)?.placeName ?? "",
            onEditMatch: editMatch,
            onDeleteMatch: deleteMatch,
            onReapplyMvp: reapplyMvp,
        };
    }, [
        (current as any)?.computedMvps,
        (current as any)?.votes,
        (current as any)?.voteCounts,
        (current as any)?.allVoted,
        (current as any)?.eligibleVoters,
        (current as any)?.teamAGoals,
        (current as any)?.teamBGoals,
        (current as any)?.goals,
        (current as any)?.teamAColor?.name,
        (current as any)?.teamAColor?.hexValue,
        (current as any)?.teamBColor?.name,
        (current as any)?.teamBColor?.hexValue,
        (current as any)?.playedAt,
        (current as any)?.placeName,
        participants,
        scoreA,
        scoreB,
        settingScore,
        voting,
        voteVoterMpId,
        voteVotedMpId,
        addingGoal,
        removingGoal,
        activePlayerId,
        groupSettings,
        groupId,
        currentMatchId,
    ]);

    async function publishMatchEvent(type: 'Gol' | 'Jogada') {
        if (!groupId || !currentMatchId) return;
        try {
            await MatchesApi.publishEvent(groupId, currentMatchId, { type, durationSeconds: 20 });
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao enviar evento de replay."));
        }
    }

    const playingGoalProps = useMemo(() => ({
        participants,
        goals: (current as any)?.goals ?? [],
        addingGoal,
        onAddGoal: addGoal,
        removingGoal,
        onRemoveGoal: removeGoal,
        onPublishEvent: publishMatchEvent,
        teamAName: (current as any)?.teamAColor?.name ?? "Time A",
        teamAHex:  (current as any)?.teamAColor?.hexValue ?? "",
        teamBName: (current as any)?.teamBColor?.name ?? "Time B",
        teamBHex:  (current as any)?.teamBColor?.hexValue ?? "",
    }), [
        participants,
        (current as any)?.goals,
        (current as any)?.teamAColor?.name,
        (current as any)?.teamAColor?.hexValue,
        (current as any)?.teamBColor?.name,
        (current as any)?.teamBColor?.hexValue,
        addingGoal,
        removingGoal,
        groupId,
        currentMatchId,
    ]);

    // When creatingNew, show the create form by nulling out the current match context
    const wizardCurrent          = creatingNew ? null : current;
    const currentExistsInCreate  = !creatingNew && !!current && stepKey === "create";

    const canRewind  = !creatingNew && admin && !!current && ((current as any)?.canRewind ?? false);
    const stepLabel  = steps.find((s) => s.key === stepKey)?.title ?? "Em andamento";

    const hasUpcoming    = upcomingMatches.length > 0;
    const canAddMore     = admin && upcomingMatches.length < MATCH_CONSTANTS.maxSimultaneous;
    const canNavPrev     = !creatingNew && selectedIdx > 0;
    const canNavNext     = !creatingNew && selectedIdx < upcomingMatches.length - 1;

    // Visual indicator for overdue / today matches
    function matchTimeLabel(iso: string): { label: string; cls: string } | null {
        const matchDay = iso.slice(0, 10);
        const today    = new Date().toISOString().slice(0, 10);
        if (matchDay === today) return { label: "HOJE",      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
        if (matchDay <  today) return { label: "ATRASADA",  cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
        return null;
    }

    return (
        <div className="space-y-5">

            <AddGuestModal
                open={addGuestOpen}
                onClose={() => setAddGuestOpen(false)}
                onSubmit={async (name, isGoalkeeper, starRating) => {
                    await addGuestToMatch(name, isGoalkeeper, starRating);
                    setAddGuestOpen(false);
                }}
            />

            {/* ── Confirmar exclusão ── */}
            {confirmDeleteOpen && selectedMatch && (
                <ModalBackdrop onClose={() => !deleting && setConfirmDeleteOpen(false)}>
                    <div className="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                        {/* Ícone */}
                        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-950/50 mx-auto">
                            <Trash2 size={22} className="text-rose-600 dark:text-rose-400" />
                        </div>

                        {/* Texto */}
                        <div className="text-center space-y-1">
                            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                Excluir partida?
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {new Date(selectedMatch.playedAt + (selectedMatch.playedAt.endsWith('Z') ? '' : 'Z')).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                {selectedMatch.placeName ? ` · ${selectedMatch.placeName}` : ''}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
                                Esta ação é irreversível. Todos os dados da partida serão perdidos.
                            </p>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteOpen(false)}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={deleteMatch}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {deleting
                                    ? <><Loader2 size={14} className="animate-spin" /> Excluindo…</>
                                    : <><Trash2 size={14} /> Excluir</>
                                }
                            </button>
                        </div>
                    </div>
                </ModalBackdrop>
            )}

            {/* ── Page header ── */}
            <div className="page-header">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon">
                            <CalendarDays size={18} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black leading-tight">Partidas</h1>
                            <p className="text-xs text-white/60 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : !groupId
                                        ? "Selecione um grupo no Dashboard"
                                        : creatingNew
                                            ? "Nova partida"
                                            : !hasUpcoming
                                                ? "Nenhuma partida em andamento"
                                                : stepLabel}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {admin && currentMatchId && displayStepKey === "accept" && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors bg-white/10 border-white/20 text-white hover:bg-white/20"
                                onClick={() => setAddGuestOpen(true)}
                            >
                                <UserPlus size={15} />
                                <span className="hidden sm:inline">Convidado</span>
                            </button>
                        )}
                        {admin && currentMatchId && !creatingNew && (
                            <button
                                type="button"
                                className={[
                                    "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors shrink-0",
                                    canRewind
                                        ? "bg-amber-500/20 border-amber-400/30 text-amber-300 hover:bg-amber-500/30"
                                        : "bg-white/5 border-white/10 text-white/30 cursor-not-allowed",
                                ].join(" ")}
                                onClick={() => { if (!canRewind) return; rewindOneStep(); }}
                                disabled={!canRewind}
                                title={canRewind ? "Voltar uma etapa" : "Não é possível voltar neste status"}
                            >
                                <RotateCcw size={14} />
                                Voltar etapa
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Multi-match navigator ── */}
            {groupId && (hasUpcoming || creatingNew) && (
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Prev arrow */}
                    <button
                        type="button"
                        onClick={() => selectMatch(selectedIdx - 1)}
                        disabled={!canNavPrev}
                        title="Partida anterior"
                        className={[
                            "inline-flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-xl border transition-all",
                            canNavPrev
                                ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed",
                        ].join(" ")}
                    >
                        <ChevronLeft size={15} />
                        <span className="hidden sm:inline">Anterior</span>
                    </button>

                    {/* Center label */}
                    <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
                        {creatingNew ? (
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                Nova partida
                            </span>
                        ) : selectedMatch ? (() => {
                            const timeTag = matchTimeLabel(selectedMatch.playedAt);
                            const matchDate = new Date(selectedMatch.playedAt).toLocaleDateString("pt-BR", {
                                weekday: "short", day: "2-digit", month: "2-digit",
                            });
                            return (
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                                        {selectedIdx + 1}&thinsp;/&thinsp;{upcomingMatches.length}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                        {matchDate}
                                        <span className="text-slate-400 dark:text-slate-500 font-normal mx-1">·</span>
                                        {selectedMatch.placeName}
                                    </span>
                                    <span className={[
                                        "hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                                        "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
                                    ].join(" ")}>
                                        {stepLabel}
                                    </span>
                                    {timeTag && (
                                        <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${timeTag.cls}`}>
                                            {timeTag.label}
                                        </span>
                                    )}
                                </div>
                            );
                        })() : null}
                    </div>

                    {/* Next arrow */}
                    <button
                        type="button"
                        onClick={() => selectMatch(selectedIdx + 1)}
                        disabled={!canNavNext}
                        title="Próxima partida"
                        className={[
                            "inline-flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-xl border transition-all",
                            canNavNext
                                ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed",
                        ].join(" ")}
                    >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight size={15} />
                    </button>

                    {/* Excluir partida */}
                    {admin && !creatingNew && selectedMatch && selectedMatch.stepKey !== 'done' && (
                        <button
                            type="button"
                            onClick={() => setConfirmDeleteOpen(true)}
                            title="Excluir partida"
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 shrink-0"
                        >
                            <Trash2 size={14} />
                            <span className="hidden sm:inline">Excluir</span>
                        </button>
                    )}

                    {/* + Nova Partida */}
                    {canAddMore && !creatingNew && (
                        <button
                            type="button"
                            onClick={() => {
                                setCreatingNew(true);
                                // Clear date/time so the user picks a fresh date for the new match
                                setPlayedAtDate(toDateInputValue(new Date()));
                                setPlayedAtTime("");
                            }}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 shrink-0"
                        >
                            <Plus size={14} />
                            <span className="hidden sm:inline">Nova Partida</span>
                        </button>
                    )}
                    {/* Cancel creating new (back to selected match) */}
                    {creatingNew && hasUpcoming && (
                        <button
                            type="button"
                            onClick={() => setCreatingNew(false)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            )}

            {/* ── Content card ── */}
            {!groupId ? (
                <div className="card p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                    <CalendarDays size={36} className="opacity-30" />
                    <span className="text-sm">Selecione um grupo no Dashboard.</span>
                </div>
            ) : (
                <div className="card p-5 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                    <MatchWizard
                        admin={admin}
                        stepKey={displayStepKey}
                        realStepKey={godPreview ? stepKey : undefined}
                        onStepClick={isGodMode() && currentMatchId ? handleGodStepClick : undefined}
                        onExitPreview={() => setGodPreview(null)}
                        steps={steps}
                        current={wizardCurrent}
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
                        onSetPlayerRole={setPlayerRole}
                        teamsProps={teamsProps}
                        onEndMatch={endMatch}
                        onGoToPostGame={goToPostGame}
                        postProps={postProps}
                        playingGoalProps={playingGoalProps}
                        onFinalize={finalizeMatch}
                        onReloadDone={loadUpcoming}
                        finalizing={finalizing as any}
                        linkedPollId={current?.linkedPollId}
                        onPollIdChange={(pollId: string | null) =>
                            setCurrent((prev) => prev ? { ...prev, linkedPollId: pollId } : prev)
                        }
                    />
                </div>
            )}
        </div>
    );
}