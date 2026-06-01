
export type GroupSettingsDto = {
    // ── backend fields (camelCase from ASP.NET Core JSON serializer) ──
    groupId?: string;
    minPlayers?: number;
    maxPlayers?: number;
    defaultPlaceName?: string | null;
    defaultDayOfWeek?: number | null;    // 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sáb
    defaultKickoffTime?: string | null;  // "HH:mm:ss" — TimeSpan from backend
    isPersisted?: boolean;
    // ── legacy aliases so getMaxPlayers() keeps working ──
    maxPlayersPerMatch?: number;
    maxPlayersInMatch?: number;
    placeName?: string;
};

export type TeamColorDto = {
    id: string;
    name: string;
    hexValue: string;
};

export type PlayerInMatchDto = {
    matchPlayerId: string; // MatchPlayerId
    playerId: string; // PlayerId
    playerName: string;
    isGoalkeeper: boolean;
    isGuest: boolean;
    team: number; // 0 unassigned, 1 A, 2 B
    inviteResponse: number; // 1 None, 2 Rejected, 3 Accepted
    absenceType?: number | null;        // null = rejeição manual ou não-rejeitado
    absenceDescription?: string | null; // ex: "Viagem - Férias em SP"
    didNotPlay?: boolean;               // admin marcou que o jogador não apareceu
};

export type VoteDto = {
    voteId: string;
    voterMatchPlayerId: string;
    votedForMatchPlayerId: string;
    voterName: string;
    votedForName: string;
};

export type VoteCountDto = {
    votedForMatchPlayerId: string;
    votedForName: string;
    count: number;
};

export type GoalDto = {
    goalId: string;
    scorerMatchPlayerId: string;
    scorerPlayerId: string;
    scorerName: string;
    assistMatchPlayerId?: string | null;
    assistPlayerId?: string | null;
    assistName?: string | null;
    timeSeconds?: number | null;
    time?: string | null;
    isOwnGoal?: boolean;
    /** Placar do Time A imediatamente após este gol (calculado pelo backend). */
    scoreAAfter?: number;
    /** Placar do Time B imediatamente após este gol (calculado pelo backend). */
    scoreBAfter?: number;
};

export type MatchMvpDto = {
    matchPlayerId: string;
    playerId: string;
    playerName: string;
    team: number;
};

export type MatchDetailsDto = {
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

    computedMvps?: MatchMvpDto[] | null;
    votes?: VoteDto[];
    voteCounts?: VoteCountDto[];
    goals?: GoalDto[];

    /** Id da votação vinculada a esta partida. Null quando não há vínculo. */
    linkedPollId?: string | null;
};

export type PlayerWeightDto = {
    playerId: string;
    weight: number;
    attackRatingNorm?:   number | null;
    defenseRatingNorm?:  number | null;
    physicalRatingNorm?: number | null;
};

export type TeamOptionExplanationDto = {
    resumo: string;
    analiseTimeA: string;
    analiseTimeB: string;
    conclusao: string;
};

export type TeamOptionDto = {
    teamA: PlayerWeightDto[];
    teamB: PlayerWeightDto[];
    unassigned: PlayerWeightDto[];
    teamAWeight: number;
    teamBWeight: number;
    balanceDiff: number;
    synergyTotal: number;
    score: number;
    explanation?: TeamOptionExplanationDto | null;
    attackDiff?:   number | null;
    defenseDiff?:  number | null;
    physicalDiff?: number | null;
};

export type TeamGenPlayerDto = {
    id: string; // playerId
    name: string;
    isGoalkeeper: boolean;
};

export const InviteResponse = {
    None: 1,
    Rejected: 2,
    Accepted: 3,
} as const;

export const STRATEGIES = [
    { id: 1, name: "Manual" },
    { id: 2, name: "Random" },
    { id: 3, name: "Algorithm" },
    { id: 4, name: "GroupByWins" },
    { id: 5, name: "Por Perfil" },
] as const;

export type StrategyId = (typeof STRATEGIES)[number]["id"];

export type ColorMode = "random" | "manual";

export type StepKey = "create" | "accept" | "teams" | "playing" | "ended" | "post" | "done";

// ── Multi-match constants (mirrors MatchConstants.cs) ──────────────────────────

export const MATCH_CONSTANTS = {
    /** Maximum non-finalized matches allowed simultaneously per group. */
    maxSimultaneous: 5,
} as const;

// ── Match header DTO (returned by /upcoming and /header) ──────────────────────

export type MatchHeaderDto = {
    matchId:    string;
    groupId:    string;
    playedAt:   string;   // ISO string
    placeName:  string;
    status:     number;
    statusName: string;
    stepKey:    StepKey;
    canRewind:  boolean;
    teamAGoals:   number | null;
    teamBGoals:   number | null;
    linkedPollId: string | null;
    /** Momento real (UTC) em que o admin clicou em Iniciar. Usar para timeline. */
    actualStartTime?: string | null;
};

export type ReplayClipDto = {
    id: string;
    objectKey: string;
    videoUrl: string;
    eventType: "Gol" | "Jogada";
    recordedAt: string;
    likeCount: number;
    isLikedByMe: boolean;
    isFavoritedByMe: boolean;
};

export type LikedReplayClipDto = ReplayClipDto & {
    matchId: string;
};

export type ClipLikerDto = {
    userId:   string;
    userName: string;
    likedAt:  string;
};

export type PublicClipDto = {
    id: string;
    videoUrl: string;
    eventType: "Gol" | "Jogada";
    recordedAt: string;
    goalNumber: number | null;
    totalGoals: number | null;
};

export type PublicMatchReplaysDto = {
    matchId: string;
    playedAt: string;
    placeName: string | null;
    teamAGoals: number | null;
    teamBGoals: number | null;
    teamAColorName: string | null;
    teamAColorHex: string | null;
    teamBColorName: string | null;
    teamBColorHex: string | null;
    clips: PublicClipDto[];
};