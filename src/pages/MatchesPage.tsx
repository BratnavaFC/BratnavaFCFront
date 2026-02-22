import { useEffect, useMemo, useState } from "react";
import { Section } from "../components/Section";
import { Stepper, Step } from "../components/Stepper";
import {
    MatchesApi,
    TeamColorApi,
    TeamGenApi,
    GroupSettingsApi,
} from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isAdmin } from "../auth/guards";

/** ========= DTOs ========= */

type GroupSettingsDto = {
    maxPlayersPerMatch?: number;
    maxPlayers?: number;
    maxPlayersInMatch?: number;
    defaultPlaceName?: string;
    placeName?: string;
    defaultMatchTime?: string; // "20:00"
    matchTime?: string; // "20:00"
};

type TeamColorDto = {
    id: string;
    name: string;
    hexValue: string;
};

type PlayerInMatchDto = {
    matchPlayerId: string; // ✅ MatchPlayerId
    playerId: string; // ✅ PlayerId
    playerName: string;
    isGoalkeeper: boolean;
    team: number; // 0 unassigned, 1 A, 2 B
    inviteResponse: number; // 1 None, 2 Rejected, 3 Accepted
};

type VoteDto = {
    voteId: string;
    voterMatchPlayerId: string;
    votedForMatchPlayerId: string;
    voterName: string;
    votedForName: string;
};

type VoteCountDto = {
    votedForMatchPlayerId: string;
    votedForName: string;
    count: number;
};

type GoalDto = {
    goalId: string;
    scorerMatchPlayerId: string;
    scorerPlayerId: string;
    scorerName: string;
    assistMatchPlayerId?: string | null;
    assistPlayerId?: string | null;
    assistName?: string | null;
    timeSeconds?: number | null;
    time?: string | null; // "21:04" ou "00:32" etc
};

type MatchMvpDto = {
    matchPlayerId: string;
    playerId: string;
    playerName: string;
    team: number;
};

type MatchDetailsDto = {
    matchId: string;
    groupId: string;
    groupName: string;
    playedAt: string;
    placeName: string;

    status: number;
    statusName: string;

    teamAGoals?: number | null;
    teamBGoals?: number | null;

    teamAColor?: TeamColorDto | null;
    teamBColor?: TeamColorDto | null;

    unassignedPlayers: PlayerInMatchDto[];
    teamAPlayers: PlayerInMatchDto[];
    teamBPlayers: PlayerInMatchDto[];

    // Pós-jogo
    computedMvp?: MatchMvpDto | null;
    votes?: VoteDto[];
    voteCounts?: VoteCountDto[];
    goals?: GoalDto[];
};

const InviteResponse = {
    None: 1,
    Rejected: 2,
    Accepted: 3,
} as const;

/**
 * Backend StrategyType:
 * Manual = 1, Random = 2, Algorithm = 3, GroupByWins = 4
 */
const STRATEGIES = [
    { id: 1, name: "Manual" },
    { id: 2, name: "Random" },
    { id: 3, name: "Algorithm" },
    { id: 4, name: "GroupByWins" },
] as const;

type StrategyId = (typeof STRATEGIES)[number]["id"];

type TeamGenPlayerDto = {
    id: string; // playerId
    name: string;
    isGoalkeeper: boolean;
};

type GeneratedTeamsDto = {
    teamA: string[]; // playerIds
    teamB: string[]; // playerIds
    unassigned: string[];
};

type ColorMode = "random" | "manual";

/** ========= Utils ========= */

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function toDateInputValue(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isValidHHmm(v: string) {
    if (!/^\d{2}:\d{2}$/.test(v)) return false;
    const [hh, mm] = v.split(":").map(Number);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function toUtcIso(dateStr: string, timeStr: string) {
    const local = new Date(`${dateStr}T${timeStr}:00`);
    return local.toISOString();
}

function cls(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

function getMaxPlayers(gs: GroupSettingsDto | null) {
    const n = gs?.maxPlayersPerMatch ?? gs?.maxPlayersInMatch ?? gs?.maxPlayers ?? 12;
    return Math.max(2, Number(n) || 12);
}

function getMatchId(m: any): string | null {
    const id = m?.matchId ?? m?.id ?? null;
    if (typeof id !== "string") return null;
    const t = id.trim();
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

function canUserActOnPlayer(isUserAdmin: boolean, activePlayerId: string | null, targetPlayerId: string) {
    if (isUserAdmin) return true;
    if (!activePlayerId) return false;
    return activePlayerId === targetPlayerId;
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const it of items) {
        if (it?.id) map.set(it.id, it);
    }
    return Array.from(map.values());
}

function MiniShirt({ color, label }: { color: string; label?: string }) {
    const safe = typeof color === "string" && color.trim() ? color.trim() : "#e2e8f0";
    return (
        <div className="mt-2 flex items-center gap-2">
            <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
                <path d="M18 12 L8 18 L14 30 L22 26 L22 14 Z" fill={safe} stroke="#0f172a" strokeOpacity="0.15" strokeWidth="2" />
                <path d="M46 12 L56 18 L50 30 L42 26 L42 14 Z" fill={safe} stroke="#0f172a" strokeOpacity="0.15" strokeWidth="2" />
                <path
                    d="M22 14 C26 18 38 18 42 14 L42 52 C42 54 40 56 38 56 H26 C24 56 22 54 22 52 Z"
                    fill={safe}
                    stroke="#0f172a"
                    strokeOpacity="0.15"
                    strokeWidth="2"
                />
                <path d="M26 14 C28 20 36 20 38 14" fill="none" stroke="#0f172a" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
            </svg>

            <div className="text-xs text-slate-600">
                <div className="font-medium text-slate-700">{label ?? "—"}</div>
                <div className="text-[11px] text-slate-500">{safe.toUpperCase()}</div>
            </div>
        </div>
    );
}

/** ========= Page ========= */

export default function MatchesPage() {
    const store = useAccountStore();
    const active = store.getActive();
    const groupId = active?.activeGroupId;

    const activePlayerId: string | null = (active as any)?.activePlayerId ?? null; // PlayerId (não matchPlayerId)
    const admin = isAdmin();

    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
    const [current, setCurrent] = useState<MatchDetailsDto | null>(null);

    const [teamColors, setTeamColors] = useState<TeamColorDto[]>([]);
    const [groupSettings, setGroupSettings] = useState<GroupSettingsDto | null>(null);

    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const [mutatingInvite, setMutatingInvite] = useState<Record<string, boolean>>({});

    /** create match */
    const [placeName, setPlaceName] = useState("");
    const [playedAtDate, setPlayedAtDate] = useState(() => toDateInputValue(new Date()));
    const [playedAtTime, setPlayedAtTime] = useState("");

    /** teamgen */
    const [strategyType, setStrategyType] = useState<StrategyId>(3);
    const [includeGoalkeepers, setIncludeGoalkeepers] = useState(true);
    const [playersPerTeam, setPlayersPerTeam] = useState(6);

    /** colors */
    const [colorMode, setColorMode] = useState<ColorMode>("manual");
    const [teamAColorId, setTeamAColorId] = useState<string>("");
    const [teamBColorId, setTeamBColorId] = useState<string>("");

    const [colorsLocked, setColorsLocked] = useState<boolean>(false);
    const [allowEditColors, setAllowEditColors] = useState<boolean>(false);

    /** assign / swap */
    const [assigningTeams, setAssigningTeams] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [swapA, setSwapA] = useState<string>("");
    const [swapB, setSwapB] = useState<string>("");

    /** post-game */
    const [settingScore, setSettingScore] = useState(false);
    const [scoreA, setScoreA] = useState<string>("");
    const [scoreB, setScoreB] = useState<string>("");

    const [voting, setVoting] = useState(false);
    const [voteVoterMpId, setVoteVoterMpId] = useState<string>("");
    const [voteVotedMpId, setVoteVotedMpId] = useState<string>("");

    const [addingGoal, setAddingGoal] = useState(false);
    const [goalScorerPlayerId, setGoalScorerPlayerId] = useState<string>("");
    const [goalAssistPlayerId, setGoalAssistPlayerId] = useState<string>("");
    const [goalTime, setGoalTime] = useState<string>(""); // "21:04" ou "00:32"

    const [removingGoal, setRemovingGoal] = useState<Record<string, boolean>>({});
    const [finalizing, setFinalizing] = useState(false);

    const maxPlayers = useMemo(() => getMaxPlayers(groupSettings), [groupSettings]);

    const placeNameOk = placeName.trim().length > 0;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(playedAtDate);
    const timeOk = isValidHHmm(playedAtTime);
    const canCreateMatch = !!groupId && placeNameOk && dateOk && timeOk && !creating;

    function pickActiveMatch(list: any[]) {
        if (!Array.isArray(list) || list.length === 0) return null;
        const notFinalized = list
            .filter((m) => Number(m?.status) !== 6 && String(m?.statusName) !== "Finalized")
            .sort((a, b) => new Date(b.playedAt ?? 0).getTime() - new Date(a.playedAt ?? 0).getTime());
        return notFinalized[0] ?? null;
    }

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

    /** ========= Status flow (NEW) =========
     * 0 Created
     * 1 Acceptation
     * 2 MatchMaking
     * 3 Started
     * 4 Ended
     * 5 PostGame
     * 6 Finalized
     */
    const stepKey = useMemo(() => {
        if (!current) return "create";

        const s = Number(current.status);

        if (s === 0) return "create";
        if (s === 1) return "accept";
        if (s === 2) return "teams";
        if (s === 3) return "playing";
        if (s === 4) return "ended";
        if (s === 5) return "post";
        if (s === 6) return "done";

        return "create";
    }, [current?.status, current?.matchId]);

    function stepsOrderDone(k: string, activeK: string) {
        const order = ["create", "accept", "teams", "playing", "ended", "post", "done"];
        return order.indexOf(k) < order.indexOf(activeK);
    }

    const steps: Step[] = [
        { key: "create", title: "Criar", subtitle: "Nova partida" },
        { key: "accept", title: "Aceitação", subtitle: "Aceitar / Recusar" },
        { key: "teams", title: "MatchMaking", subtitle: "Times / cores / swap" },
        { key: "playing", title: "Jogo", subtitle: "Iniciada" },
        { key: "ended", title: "Encerrar", subtitle: "Fim do jogo" },
        { key: "post", title: "Pós-jogo", subtitle: "MVP / gols / placar" },
        { key: "done", title: "Final", subtitle: "Finalizada" },
    ].map((s) => ({ ...s, done: stepsOrderDone(s.key, stepKey) }));

    /** ========= Derived lists ========= */

    const allPlayers = useMemo<PlayerInMatchDto[]>(() => {
        if (!current) return [];
        return [
            ...(current.unassignedPlayers ?? []),
            ...(current.teamAPlayers ?? []),
            ...(current.teamBPlayers ?? []),
        ];
    }, [current]);

    const participants = useMemo<PlayerInMatchDto[]>(() => {
        if (!current) return [];

        // Fonte mais confiável: times setados
        const a = Array.isArray(current.teamAPlayers) ? current.teamAPlayers : [];
        const b = Array.isArray(current.teamBPlayers) ? current.teamBPlayers : [];

        const base = [...a, ...b];

        // fallback: se por algum motivo timeA/teamB vierem vazios,
        // tenta filtrar por "team" (1=A, 2=B)
        const fallback = allPlayers.filter((p) => Number(p.team) === 1 || Number(p.team) === 2);

        const list = base.length ? base : fallback;

        // garantir sem duplicados (por playerId)
        const map = new Map<string, PlayerInMatchDto>();
        for (const p of list) {
            if (p?.playerId) map.set(String(p.playerId), p);
        }
        return Array.from(map.values());
    }, [current, allPlayers]);

    const activeMatchPlayerId = useMemo(() => {
        if (!activePlayerId) return "";
        const mp = participants.find((p) => String(p.playerId) === String(activePlayerId));
        return mp?.matchPlayerId ?? "";
    }, [activePlayerId, participants]);

    const invitePool = useMemo<PlayerInMatchDto[]>(() => {
        // Aceitação usa “unassignedPlayers” como pool
        const list = current?.unassignedPlayers ?? [];
        return Array.isArray(list) ? list : [];
    }, [current]);

    const accepted = useMemo(
        () => invitePool.filter((p) => Number(p.inviteResponse) === InviteResponse.Accepted),
        [invitePool]
    );

    const rejected = useMemo(
        () => invitePool.filter((p) => Number(p.inviteResponse) === InviteResponse.Rejected),
        [invitePool]
    );

    const pending = useMemo(
        () => invitePool.filter((p) => Number(p.inviteResponse) === InviteResponse.None),
        [invitePool]
    );

    const acceptedOverLimit = accepted.length > maxPlayers;

    useEffect(() => {
        loadList();
        // eslint-disable-next-line
    }, [groupId]);

    // ✅ FIX UX: se existe "draft" (status 0), manter o formulário de criação visível
    const showCreate = useMemo(() => {
        if (!current) return true;
        return stepKey === "create";
    }, [current, stepKey]);

    /** ========= Actions ========= */

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

    /** ========= MatchMaking: TeamGen / Colors / Assign / Swap ========= */

    // ✅ refletir cores já setadas do backend
    useEffect(() => {
        if (!current) return;

        const aId = current.teamAColor?.id ?? "";
        const bId = current.teamBColor?.id ?? "";

        const alreadySet = !!aId || !!bId;

        if (aId) setTeamAColorId(aId);
        if (bId) setTeamBColorId(bId);

        setColorsLocked(alreadySet);
        setAllowEditColors(false);
    }, [current?.matchId, current?.teamAColor?.id, current?.teamBColor?.id]); // eslint-disable-line

    // ✅ fallback: se não setado, usar primeiras do banco
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

    async function generateTeams() {
        if (!groupId || !current) return;

        const acceptedAll = allPlayers.filter((p) => Number(p.inviteResponse) === InviteResponse.Accepted);

        const players: TeamGenPlayerDto[] = uniqById(
            acceptedAll
                .filter((p) => typeof p.playerId === "string" && p.playerId.trim().length > 0)
                .map((p) => ({
                    id: p.playerId, // playerId
                    name: p.playerName ?? "—",
                    isGoalkeeper: !!p.isGoalkeeper,
                }))
        );

        if (players.length < 2) return;

        const req = { players, strategyType, playersPerTeam, includeGoalkeepers };
        const res = await TeamGenApi.generate(req as any);
        setCurrent((c: any) => ({ ...c, generatedTeams: res.data }));
    }

    async function setColorsRandomDistinct() {
        if (!groupId || !currentMatchId) return;

        const colors = (teamColors ?? []).filter((c) => c?.id);
        if (colors.length < 2) return;

        const shuffled = [...colors].sort(() => Math.random() - 0.5);
        const a = shuffled[0];
        const b = shuffled.find((x) => x.id !== a.id) ?? shuffled[1];

        await MatchesApi.setColors(groupId, currentMatchId, {
            teamAColorId: a.id,
            teamBColorId: b.id,
        } as any);

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

    const teamsAlreadyAssigned = useMemo(() => {
        const a = current?.teamAPlayers?.length ?? 0;
        const b = current?.teamBPlayers?.length ?? 0;
        return a > 0 && b > 0;
    }, [current?.teamAPlayers, current?.teamBPlayers]);

    async function assignTeamsFromGenerated() {
        if (!admin || !groupId || !currentMatchId) return;

        const gt = (current as any)?.generatedTeams as GeneratedTeamsDto | undefined;
        if (!gt) return;

        const teamAPlayerIds = Array.isArray(gt.teamA) ? gt.teamA : [];
        const teamBPlayerIds = Array.isArray(gt.teamB) ? gt.teamB : [];

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
            await MatchesApi.swap(groupId, currentMatchId, {
                playerAId: swapA,
                playerBId: swapB,
            } as any);
            setSwapA("");
            setSwapB("");
            await refreshCurrent();
        } finally {
            setSwapping(false);
        }
    }

    const canAssignTeams = useMemo(() => {
        const gt = (current as any)?.generatedTeams as GeneratedTeamsDto | undefined;
        const a = gt?.teamA?.length ?? 0;
        const b = gt?.teamB?.length ?? 0;
        return admin && !teamsAlreadyAssigned && a > 0 && b > 0;
    }, [admin, current, teamsAlreadyAssigned]);

    const canSwap = admin && teamsAlreadyAssigned;

    const teamAColor = useMemo(
        () => teamColors.find((c) => String(c.id) === String(teamAColorId)) ?? null,
        [teamColors, teamAColorId]
    );

    const teamBColor = useMemo(
        () => teamColors.find((c) => String(c.id) === String(teamBColorId)) ?? null,
        [teamColors, teamBColorId]
    );

    const generatedTeamsView = useMemo(() => {
        const gt = (current as any)?.generatedTeams as GeneratedTeamsDto | undefined;
        if (!gt || !current) return null;

        const teamAIds = Array.isArray(gt.teamA) ? gt.teamA : [];
        const teamBIds = Array.isArray(gt.teamB) ? gt.teamB : [];

        const byPlayerId = new Map<string, PlayerInMatchDto>();
        for (const p of allPlayers) {
            if (p?.playerId) byPlayerId.set(p.playerId, p);
        }

        const renderList = (ids: string[]) => (
            <ul className="mt-3 space-y-2 text-sm">
                {ids.map((playerId) => {
                    const p = byPlayerId.get(playerId);
                    const name = p?.playerName ?? playerId;
                    const isGk = !!p?.isGoalkeeper;

                    return (
                        <li
                            key={playerId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                            <span className="truncate font-medium text-slate-900">
                                {name} {isGk ? <span title="Goleiro">🧤</span> : null}
                            </span>
                            <span className="text-xs text-slate-500 truncate">{playerId}</span>
                        </li>
                    );
                })}
                {ids.length === 0 ? <li className="text-slate-500">Nenhum.</li> : null}
            </ul>
        );

        return (
            <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">Prévia • Time A</div>
                        <span className="pill">{teamAIds.length}</span>
                    </div>
                    {renderList(teamAIds)}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">Prévia • Time B</div>
                        <span className="pill">{teamBIds.length}</span>
                    </div>
                    {renderList(teamBIds)}
                </div>
            </div>
        );
    }, [current, allPlayers]);

    const assignedTeamsView = useMemo(() => {
        if (!current) return null;
        if (!teamsAlreadyAssigned) return null;

        const renderPlayers = (ps: PlayerInMatchDto[]) => (
            <ul className="mt-3 space-y-2 text-sm">
                {ps.map((p) => (
                    <li
                        key={p.playerId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                        <span className="truncate font-medium text-slate-900">
                            {p.playerName} {p.isGoalkeeper ? <span title="Goleiro">🧤</span> : null}
                        </span>
                        <span className="text-xs text-slate-500 truncate">{p.playerId}</span>
                    </li>
                ))}
                {ps.length === 0 ? <li className="text-slate-500">Nenhum.</li> : null}
            </ul>
        );

        return (
            <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">Times setados • Time A</div>
                        <span className="pill">{current.teamAPlayers.length}</span>
                    </div>
                    {renderPlayers(current.teamAPlayers)}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">Times setados • Time B</div>
                        <span className="pill">{current.teamBPlayers.length}</span>
                    </div>
                    {renderPlayers(current.teamBPlayers)}
                </div>
            </div>
        );
    }, [current, teamsAlreadyAssigned]);

    const canStartNow = useMemo(() => {
        // Start só no step teams (MatchMaking) e precisa de times setados
        return admin && stepKey === "teams" && teamsAlreadyAssigned;
    }, [admin, stepKey, teamsAlreadyAssigned]);

    /** ========= PostGame UI actions ========= */

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

        const voter = admin ? voteVoterMpId : activeMatchPlayerId;
        const voted = voteVotedMpId;

        if (!voter || !voted) return;

        setVoting(true);
        try {
            await MatchesApi.vote(groupId, currentMatchId, {
                voterPlayerId: voter,
                votedPlayerId: voted,
            } as any);
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

    /** ========= InviteList component ========= */

    function InviteList({
        title,
        items,
        variant,
    }: {
        title: string;
        items: PlayerInMatchDto[];
        variant: "accepted" | "rejected" | "pending";
    }) {
        return (
            <div className="card p-4">
                <div className="flex items-center justify-between">
                    <div className="font-semibold">{title}</div>
                    <span className="pill">{items.length}</span>
                </div>

                <div className="mt-3 grid gap-2">
                    {items.map((p) => {
                        const pid = p.playerId;
                        const name = p.playerName || "—";
                        const canAct = canUserActOnPlayer(admin, activePlayerId, pid);
                        const busy = !!mutatingInvite[pid];

                        const showAccept = canAct && (variant === "pending" || variant === "rejected");
                        const showReject = canAct && (variant === "pending" || variant === "accepted");

                        return (
                            <div
                                key={pid}
                                className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2 bg-white"
                            >
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{name}</div>
                                    <div className="text-xs text-slate-500 truncate">{pid}</div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {showReject ? (
                                        <button
                                            className={cls("btn", busy && "opacity-50 pointer-events-none")}
                                            title="Recusar"
                                            disabled={busy}
                                            onClick={() => rejectInvite(pid)}
                                        >
                                            ✕
                                        </button>
                                    ) : null}

                                    {showAccept ? (
                                        <button
                                            className={cls("btn btn-primary", busy && "opacity-50 pointer-events-none")}
                                            title="Aceitar"
                                            disabled={busy}
                                            onClick={() => acceptInvite(pid)}
                                        >
                                            ✓
                                        </button>
                                    ) : null}

                                    {!canAct ? <span className="pill">—</span> : null}
                                </div>
                            </div>
                        );
                    })}

                    {items.length === 0 ? <div className="muted">Nenhum.</div> : null}
                </div>
            </div>
        );
    }

    /** ========= Render ========= */

    return (
        <div className="space-y-6">
            <Section
                title="Partida (Match Wizard)"
                right={<span className="pill">{loading ? "carregando..." : current ? "ativa" : "sem partida"}</span>}
            >
                {!groupId ? (
                    <div className="muted">Selecione um Group no Dashboard.</div>
                ) : (
                    <div className="space-y-4">
                        <Stepper steps={steps} activeKey={stepKey} />

                        {/* ✅ FIX: se stepKey === "create" mesmo com current preenchido, mostrar a tela de criar */}
                        {showCreate ? (
                            <div className="grid lg:grid-cols-2 gap-4">
                                <div className="card p-4 space-y-4">
                                    <div className="font-semibold">Criar nova partida</div>
                                    <div className="muted">
                                        Não pode criar sem <b>Local</b> e <b>Horário</b>.
                                    </div>

                                    <label className="block">
                                        <div className="label">Local (PlaceName) *</div>
                                        <input
                                            className="input"
                                            placeholder="Ex: Boca Jrs"
                                            value={placeName}
                                            onChange={(e) => setPlaceName(e.target.value)}
                                        />
                                    </label>

                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block">
                                            <div className="label">Data *</div>
                                            <input
                                                className="input"
                                                type="date"
                                                value={playedAtDate}
                                                onChange={(e) => setPlayedAtDate(e.target.value)}
                                            />
                                        </label>

                                        <label className="block">
                                            <div className="label">Horário *</div>
                                            <input
                                                className="input"
                                                type="time"
                                                value={playedAtTime}
                                                onChange={(e) => setPlayedAtTime(e.target.value)}
                                            />
                                        </label>
                                    </div>

                                    <button
                                        className={cls("btn btn-primary", !canCreateMatch && "opacity-50 pointer-events-none")}
                                        disabled={!canCreateMatch}
                                        onClick={createMatch}
                                    >
                                        {creating ? "Criando..." : "Criar partida"}
                                    </button>

                                    {current && stepKey === "create" ? (
                                        <div className="text-xs text-slate-500">
                                            Existe uma partida em <b>status Created</b> carregada (draft). Por isso esta tela continua visível.
                                        </div>
                                    ) : null}
                                </div>

                                <div className="card p-4">
                                    <div className="font-semibold">Histórico</div>
                                    <div className="muted">Se existir partida não-finalizada, ela será carregada automaticamente.</div>

                                    <div className="mt-3 grid gap-2">
                                        {matches.map((m) => {
                                            const id = getMatchId(m);
                                            if (!id) return null;

                                            return (
                                                <button
                                                    key={id}
                                                    className="btn justify-between"
                                                    onClick={async () => {
                                                        setCurrentMatchId(id);
                                                        await loadDetails(id);
                                                    }}
                                                >
                                                    <span>
                                                        {m.playedAt ? new Date(m.playedAt).toLocaleString() : "Partida"} •{" "}
                                                        {m.statusName ?? m.status}
                                                    </span>
                                                    <span className="pill">{id === currentMatchId ? "Selecionada" : "Abrir"}</span>
                                                </button>
                                            );
                                        })}
                                        {matches.length === 0 ? <div className="muted">Sem partidas ainda.</div> : null}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* HEADER */}
                                <div className="card p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="font-semibold">Partida Atual</div>
                                            <div className="muted mt-1 truncate">
                                                {current?.playedAt ? new Date(current.playedAt).toLocaleString() : "—"} •{" "}
                                                {current?.placeName ?? "—"}
                                            </div>
                                            <div className="muted">Status: {String(current?.statusName ?? current?.status)}</div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="pill">Aceitos: {accepted.length}/{maxPlayers}</span>
                                            <span className="pill">Pendentes: {pending.length}</span>
                                        </div>
                                    </div>

                                    {acceptedOverLimit ? (
                                        <div className="mt-3 text-sm text-red-700">
                                            Passou do limite de aceitos: <b>{accepted.length}</b> / <b>{maxPlayers}</b>. Recuse alguns para poder avançar.
                                        </div>
                                    ) : null}
                                </div>

                                {/* ACCEPTATION */}
                                {stepKey === "accept" ? (
                                    <div className="space-y-4">
                                        <div className="grid lg:grid-cols-3 gap-4">
                                            <InviteList title="Aceitos" items={accepted} variant="accepted" />
                                            <InviteList title="Não Aceitos" items={rejected} variant="rejected" />
                                            <InviteList title="Pendentes" items={pending} variant="pending" />
                                        </div>

                                        <div className="card p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="muted text-sm">
                                                    {admin ? (
                                                        <>Admin: você pode aceitar/recusar <b>qualquer jogador</b>.</>
                                                    ) : (
                                                        <>Você só pode aceitar/recusar <b>seu próprio nome</b>.</>
                                                    )}
                                                    <div className="muted">
                                                        Regras: pendente → qualquer lista; aceito ↔ não aceito; <b>não volta para pendente</b>.
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button className="btn" onClick={refreshCurrent}>Recarregar</button>

                                                    {admin ? (
                                                        <button
                                                            className={cls(
                                                                "btn btn-primary",
                                                                (acceptedOverLimit || accepted.length < 2) && "opacity-50 pointer-events-none"
                                                            )}
                                                            disabled={acceptedOverLimit || accepted.length < 2}
                                                            onClick={goToMatchMaking}
                                                            title="Avança para MatchMaking (times/cores/swap)"
                                                        >
                                                            Ir para MatchMaking
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {/* MATCHMAKING */}
                                {stepKey === "teams" ? (
                                    <div className="card p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-semibold">MatchMaking (Times / cores / swap)</div>

                                            <div className="flex items-center gap-2">
                                                <button className="btn" onClick={refreshCurrent}>Recarregar</button>
                                                {admin ? (
                                                    <button className="btn btn-primary" onClick={generateTeams}>
                                                        Gerar times
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>

                                        {/* Config TeamGen */}
                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            <label className="block">
                                                <div className="label">Algoritmo</div>
                                                <select
                                                    className="input h-9 text-sm"
                                                    value={strategyType}
                                                    onChange={(e) => setStrategyType(Number(e.target.value) as StrategyId)}
                                                    disabled={!admin}
                                                >
                                                    {STRATEGIES.map((s) => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="block">
                                                <div className="label">Players/Team</div>
                                                <input
                                                    className="input h-9 text-sm"
                                                    type="number"
                                                    value={playersPerTeam}
                                                    onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                                                    disabled={!admin}
                                                />
                                            </label>

                                            <label className="block">
                                                <div className="label">Include GK</div>
                                                <input className="input h-9 text-sm" value={includeGoalkeepers ? "true" : "false"} readOnly />
                                            </label>
                                        </div>

                                        <label className="flex items-center gap-2 mt-3">
                                            <input
                                                type="checkbox"
                                                checked={includeGoalkeepers}
                                                onChange={(e) => setIncludeGoalkeepers(e.target.checked)}
                                                disabled={!admin}
                                            />
                                            <span className="text-sm font-medium text-slate-700">Incluir goleiros</span>
                                        </label>

                                        {/* CORES */}
                                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold text-slate-900">Cores dos times</div>
                                                    <div className="text-xs text-slate-500">
                                                        Se já estiver setado, fica travado. Marque “alterar cores” para liberar.
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <select
                                                        className="input h-9 text-sm w-36"
                                                        value={colorMode}
                                                        onChange={(e) => setColorMode(e.target.value as ColorMode)}
                                                        disabled={colorsReadOnly}
                                                    >
                                                        <option value="manual">Manual</option>
                                                        <option value="random">Aleatório</option>
                                                    </select>

                                                    {colorsLocked ? (
                                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                                            <input
                                                                type="checkbox"
                                                                checked={allowEditColors}
                                                                onChange={(e) => setAllowEditColors(e.target.checked)}
                                                                disabled={!admin}
                                                            />
                                                            <span>Alterar cores</span>
                                                        </label>
                                                    ) : null}

                                                    {admin ? (
                                                        colorMode === "random" ? (
                                                            <button
                                                                className={cls("btn h-9", colorsReadOnly && "opacity-50 pointer-events-none")}
                                                                disabled={colorsReadOnly}
                                                                onClick={setColorsRandomDistinct}
                                                            >
                                                                Sortear e aplicar
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className={cls(
                                                                    "btn h-9",
                                                                    (colorsReadOnly || !teamAColorId || !teamBColorId) && "opacity-50 pointer-events-none"
                                                                )}
                                                                disabled={colorsReadOnly || !teamAColorId || !teamBColorId}
                                                                onClick={applyManualColors}
                                                            >
                                                                Aplicar cores
                                                            </button>
                                                        )
                                                    ) : null}
                                                </div>
                                            </div>

                                            {colorMode === "manual" ? (
                                                <div className="grid md:grid-cols-2 gap-4 mt-4">
                                                    <div className="min-w-0">
                                                        <div className="label">Time A</div>
                                                        <select
                                                            className="input h-9 text-sm max-w-[280px]"
                                                            value={teamAColorId}
                                                            onChange={(e) => setTeamAColorId(e.target.value)}
                                                            disabled={colorsReadOnly}
                                                        >
                                                            {teamColors.map((c) => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>

                                                        <MiniShirt
                                                            color={teamAColor?.hexValue ?? current.teamAColor?.hexValue ?? "#e2e8f0"}
                                                            label={teamAColor?.name ?? current.teamAColor?.name ?? "—"}
                                                        />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="label">Time B</div>
                                                        <select
                                                            className="input h-9 text-sm max-w-[280px]"
                                                            value={teamBColorId}
                                                            onChange={(e) => setTeamBColorId(e.target.value)}
                                                            disabled={colorsReadOnly}
                                                        >
                                                            {teamColors.map((c) => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>

                                                        <MiniShirt
                                                            color={teamBColor?.hexValue ?? current.teamBColor?.hexValue ?? "#e2e8f0"}
                                                            label={teamBColor?.name ?? current.teamBColor?.name ?? "—"}
                                                        />
                                                    </div>

                                                    {teamAColorId && teamBColorId && teamAColorId === teamBColorId ? (
                                                        <div className="md:col-span-2 text-xs text-amber-700">
                                                            As duas cores estão iguais. Se quiser, selecione cores diferentes.
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <div className="mt-3 text-sm text-slate-600">
                                                    No modo <b>Aleatório</b>, escolhe 2 cores do banco <b>sem repetir</b> e aplica na hora.
                                                </div>
                                            )}
                                        </div>

                                        {/* TIMES GERADOS */}
                                        {generatedTeamsView ? generatedTeamsView : <div className="muted mt-3">Gere times para visualizar aqui.</div>}

                                        {/* SETAR TIMES */}
                                        {admin ? (
                                            <div className="mt-4 flex items-center gap-3">
                                                <button
                                                    className={cls("btn btn-primary", (!canAssignTeams || assigningTeams) && "opacity-50 pointer-events-none")}
                                                    disabled={!canAssignTeams || assigningTeams}
                                                    onClick={assignTeamsFromGenerated}
                                                >
                                                    {assigningTeams ? "Setando..." : teamsAlreadyAssigned ? "Times já setados" : "Setar times"}
                                                </button>

                                                {teamsAlreadyAssigned ? (
                                                    <span className="text-xs text-slate-500">
                                                        Times já foram setados. Use o swap para trocar 1 jogador de cada lado.
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {/* TIMES SETADOS */}
                                        {assignedTeamsView}

                                        {/* SWAP */}
                                        {canSwap ? (
                                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="font-semibold text-slate-900">Trocar jogadores (swap)</div>
                                                        <div className="text-xs text-slate-500">
                                                            Selecione 1 do Time A e 1 do Time B, depois confirme.
                                                        </div>
                                                    </div>

                                                    <button
                                                        className={cls("btn btn-primary h-9", (!swapA || !swapB || swapping) && "opacity-50 pointer-events-none")}
                                                        disabled={!swapA || !swapB || swapping}
                                                        onClick={swapPlayers}
                                                    >
                                                        {swapping ? "Trocando..." : "Trocar"}
                                                    </button>
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-4 mt-4">
                                                    <label className="block">
                                                        <div className="label">Jogador do Time A</div>
                                                        <select className="input h-9 text-sm" value={swapA} onChange={(e) => setSwapA(e.target.value)}>
                                                            <option value="">Selecione...</option>
                                                            {(current?.teamAPlayers ?? []).map((p) => (
                                                                <option key={p.playerId} value={p.playerId}>
                                                                    {p.playerName} {p.isGoalkeeper ? "🧤" : ""}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>

                                                    <label className="block">
                                                        <div className="label">Jogador do Time B</div>
                                                        <select className="input h-9 text-sm" value={swapB} onChange={(e) => setSwapB(e.target.value)}>
                                                            <option value="">Selecione...</option>
                                                            {(current?.teamBPlayers ?? []).map((p) => (
                                                                <option key={p.playerId} value={p.playerId}>
                                                                    {p.playerName} {p.isGoalkeeper ? "🧤" : ""}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* START */}
                                        {admin ? (
                                            <div className="mt-4 flex items-center justify-end gap-2">
                                                <button
                                                    className={cls("btn btn-primary", !canStartNow && "opacity-50 pointer-events-none")}
                                                    disabled={!canStartNow}
                                                    onClick={startMatch}
                                                    title={!teamsAlreadyAssigned ? "Defina os times antes de iniciar" : "Iniciar partida"}
                                                >
                                                    Start
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {/* PLAYING */}
                                {stepKey === "playing" ? (
                                    <div className="card p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">Jogo</div>
                                                <div className="text-xs text-slate-500">Partida iniciada</div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button className="btn" onClick={refreshCurrent}>Recarregar</button>

                                                {admin ? (
                                                    <button className="btn btn-primary" onClick={endMatch}>
                                                        End
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {/* ENDED */}
                                {stepKey === "ended" ? (
                                    <div className="card p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">Encerrar</div>
                                                <div className="text-xs text-slate-500">Partida encerrada. Avance para o Pós-jogo.</div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button className="btn" onClick={refreshCurrent}>Recarregar</button>

                                                {admin ? (
                                                    <button className="btn btn-primary" onClick={goToPostGame}>
                                                        Ir para Pós-jogo
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {/* POSTGAME */}
                                {stepKey === "post" ? (
                                    <div className="space-y-4">
                                        <div className="card p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold">Pós-jogo</div>
                                                    <div className="text-xs text-slate-500">Voto MVP • Placar • Gols • Finalizar</div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button className="btn" onClick={refreshCurrent}>Recarregar</button>
                                                    {admin ? (
                                                        <button
                                                            className={cls("btn btn-primary", finalizing && "opacity-50 pointer-events-none")}
                                                            disabled={finalizing}
                                                            onClick={finalizeMatch}
                                                        >
                                                            {finalizing ? "Finalizando..." : "Finalizar"}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* MVP */}
                                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="font-semibold text-slate-900">Votar MVP</div>
                                                <div className="text-xs text-slate-500">Cada jogador vota 1 vez. Admin pode votar por qualquer um.</div>

                                                <div className="grid md:grid-cols-3 gap-3 mt-3">
                                                    <label className="block">
                                                        <div className="label">Quem vota</div>
                                                        <select
                                                            className="input h-9 text-sm"
                                                            value={admin ? voteVoterMpId : activeMatchPlayerId}
                                                            onChange={(e) => setVoteVoterMpId(e.target.value)}
                                                            disabled={!admin}
                                                        >
                                                            <option value="">{admin ? "Selecione..." : "Seu usuário"}</option>
                                                            {participants.map((p) => (
                                                                <option key={p.matchPlayerId} value={p.matchPlayerId}>
                                                                    {p.playerName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>

                                                    <label className="block md:col-span-2">
                                                        <div className="label">Votado</div>
                                                        <select
                                                            className="input h-9 text-sm"
                                                            value={voteVotedMpId}
                                                            onChange={(e) => setVoteVotedMpId(e.target.value)}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {participants.map((p) => (
                                                                <option key={p.matchPlayerId} value={p.matchPlayerId}>
                                                                    {p.playerName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    <div className="text-xs text-slate-500">
                                                        MVP atual:{" "}
                                                        <b>{current.computedMvp?.playerName?.trim() ? current.computedMvp.playerName : "—"}</b>
                                                    </div>

                                                    <button
                                                        className={cls("btn btn-primary", (!voteVotedMpId || voting) && "opacity-50 pointer-events-none")}
                                                        disabled={!voteVotedMpId || voting || (!admin && !activeMatchPlayerId)}
                                                        onClick={voteMvp}
                                                    >
                                                        {voting ? "Votando..." : "Votar"}
                                                    </button>
                                                </div>

                                                {/* Top votes */}
                                                <div className="mt-4">
                                                    <div className="text-sm font-semibold text-slate-900">Parciais</div>
                                                    <div className="mt-2 grid gap-2">
                                                        {(current.voteCounts ?? []).length === 0 ? (
                                                            <div className="muted">Sem votos ainda.</div>
                                                        ) : (
                                                            (current.voteCounts ?? []).map((v) => (
                                                                <div
                                                                    key={v.votedForMatchPlayerId}
                                                                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                                >
                                                                    <div className="font-medium text-slate-900 truncate">{v.votedForName}</div>
                                                                    <span className="pill">{v.count}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SCORE */}
                                            {admin ? (
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

                                                    <div className="mt-3 flex items-center justify-between">
                                                        <div className="text-xs text-slate-500">
                                                            Atual: <b>{current.teamAGoals ?? "—"}</b> x <b>{current.teamBGoals ?? "—"}</b>
                                                        </div>

                                                        <button
                                                            className={cls("btn btn-primary", settingScore && "opacity-50 pointer-events-none")}
                                                            disabled={settingScore}
                                                            onClick={setScore}
                                                        >
                                                            {settingScore ? "Salvando..." : "Salvar placar"}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* GOALS */}
                                            {admin ? (
                                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                                    <div className="font-semibold text-slate-900">Gols</div>
                                                    <div className="text-xs text-slate-500">Adicionar/remover gols (recalcula o placar automaticamente).</div>

                                                    <div className="grid md:grid-cols-3 gap-3 mt-3">
                                                        <label className="block">
                                                            <div className="label">Autor</div>
                                                            <select
                                                                className="input h-9 text-sm"
                                                                value={goalScorerPlayerId}
                                                                onChange={(e) => setGoalScorerPlayerId(e.target.value)}
                                                            >
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
                                                            <select
                                                                className="input h-9 text-sm"
                                                                value={goalAssistPlayerId}
                                                                onChange={(e) => setGoalAssistPlayerId(e.target.value)}
                                                            >
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
                                                            <input
                                                                className="input h-9 text-sm"
                                                                value={goalTime}
                                                                onChange={(e) => setGoalTime(e.target.value)}
                                                                placeholder="21:04"
                                                            />
                                                        </label>
                                                    </div>

                                                    <div className="mt-3 flex justify-end">
                                                        <button
                                                            className={cls("btn btn-primary", (!goalScorerPlayerId || !goalTime.trim() || addingGoal) && "opacity-50 pointer-events-none")}
                                                            disabled={!goalScorerPlayerId || !goalTime.trim() || addingGoal}
                                                            onClick={addGoal}
                                                        >
                                                            {addingGoal ? "Adicionando..." : "Adicionar gol"}
                                                        </button>
                                                    </div>

                                                    <div className="mt-4">
                                                        <div className="text-sm font-semibold text-slate-900">Lista de gols</div>
                                                        <div className="mt-2 grid gap-2">
                                                            {(current.goals ?? []).length === 0 ? (
                                                                <div className="muted">Sem gols.</div>
                                                            ) : (
                                                                (current.goals ?? []).map((g) => (
                                                                    <div key={g.goalId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                                        <div className="min-w-0">
                                                                            <div className="font-medium text-slate-900 truncate">
                                                                                {g.scorerName}
                                                                                {g.assistName ? <span className="text-slate-500"> • ass: {g.assistName}</span> : null}
                                                                            </div>
                                                                            <div className="text-xs text-slate-500 truncate">
                                                                                {g.time ?? "—"} • goalId: {g.goalId}
                                                                            </div>
                                                                        </div>

                                                                        <button
                                                                            className={cls("btn", removingGoal[g.goalId] && "opacity-50 pointer-events-none")}
                                                                            disabled={!!removingGoal[g.goalId]}
                                                                            onClick={() => removeGoal(g.goalId)}
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
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}

                                {/* DONE */}
                                {stepKey === "done" ? (
                                    <div className="card p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold">Finalizada</div>
                                                <div className="text-xs text-slate-500">Partida encerrada e contabilizada.</div>
                                            </div>
                                            <button className="btn" onClick={loadList}>Atualizar lista</button>
                                        </div>

                                        <div className="mt-3 text-sm">
                                            Placar: <b>{current.teamAGoals ?? "—"}</b> x <b>{current.teamBGoals ?? "—"}</b>
                                        </div>
                                        <div className="mt-1 text-sm">
                                            MVP: <b>{current.computedMvp?.playerName ?? "—"}</b>
                                        </div>
                                    </div>
                                ) : null}

                                {/* HISTÓRICO sempre visível */}
                                <div className="card p-4">
                                    <div className="font-semibold">Histórico</div>
                                    <div className="muted">Clique para abrir uma partida</div>
                                    <div className="mt-3 grid gap-2">
                                        {matches.map((m) => {
                                            const id = getMatchId(m);
                                            if (!id) return null;

                                            return (
                                                <button
                                                    key={id}
                                                    className="btn justify-between"
                                                    onClick={async () => {
                                                        setCurrentMatchId(id);
                                                        await loadDetails(id);
                                                    }}
                                                >
                                                    <span>
                                                        {m.playedAt ? new Date(m.playedAt).toLocaleString() : "Partida"} •{" "}
                                                        {m.statusName ?? m.status}
                                                    </span>
                                                    <span className="pill">{id === currentMatchId ? "Selecionada" : "Abrir"}</span>
                                                </button>
                                            );
                                        })}
                                        {matches.length === 0 ? <div className="muted">Sem partidas ainda.</div> : null}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Section>
        </div>
    );
}