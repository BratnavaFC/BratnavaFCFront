
export type GroupSettingsDto = {
    maxPlayersPerMatch?: number;
    maxPlayers?: number;
    maxPlayersInMatch?: number;
    defaultPlaceName?: string;
    placeName?: string;
    defaultMatchTime?: string; // "20:00"
    matchTime?: string; // "20:00"
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
    team: number; // 0 unassigned, 1 A, 2 B
    inviteResponse: number; // 1 None, 2 Rejected, 3 Accepted
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

    computedMvp?: MatchMvpDto | null;
    votes?: VoteDto[];
    voteCounts?: VoteCountDto[];
    goals?: GoalDto[];
};

export type PlayerWeightDto = {
    playerId: string;
    weight: number;
};

export type TeamOptionDto = {
    teamA: PlayerWeightDto[];
    teamB: PlayerWeightDto[];
    unassigned: PlayerWeightDto[];
    teamAWeight: number;
    teamBWeight: number;
    balanceDiff: number;
    goalkeeperDiff: number;
    synergyTotal: number;
    score: number;
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
] as const;

export type StrategyId = (typeof STRATEGIES)[number]["id"];

export type ColorMode = "random" | "manual";

export type StepKey = "create" | "accept" | "teams" | "playing" | "ended" | "post" | "done";