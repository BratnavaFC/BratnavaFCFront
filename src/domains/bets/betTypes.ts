export type BetCategory = "WinningTeam" | "FinalScore" | "PlayerGoals" | "PlayerAssists";

export interface BetPlayer {
    matchPlayerId:      string;
    playerId:           string;
    name:               string;
    team:               number; // 0=unassigned, 1=TeamA, 2=TeamB
    hasBet:             boolean;
    totalFichasWagered: number | null;
}

export interface BetSelectionDto {
    id:              string;
    category:        string;
    predictedValue:  string;
    actualValue:     string | null;
    fichasWagered:   number;
    fichasEarned:    number | null;
    isCorrect:       boolean | null;
    isPartialCredit: boolean | null;
}

export interface MatchBetDto {
    id:               string;
    matchId:          string;
    userId:           string;
    userName:         string;
    isResolved:       boolean;
    isLocked:         boolean;
    selections:       BetSelectionDto[];
    totalFichasEarned: number | null;
}

export interface CurrentMatchBetContextDto {
    matchId:       string;
    playedAt:      string;
    statusName:    string;
    betWindowOpen: boolean;
    players:       BetPlayer[];
    myBet:         MatchBetDto | null;
}

export interface UserBetResultDto {
    userId:            string;
    userName:          string;
    selections:        BetSelectionDto[];
    totalFichasEarned: number;
    currentBalance:    number;
}

export interface MatchBetResultsDto {
    matchId:    string;
    isResolved: boolean;
    userBets:   UserBetResultDto[];
}

export interface BetLeaderboardEntryDto {
    rank:         number;
    userId:       string;
    userName:     string;
    balance:      number;
    totalBets:    number;
    totalCorrect: number;
}

// ── Histórico ─────────────────────────────────────────────────────────────────

export interface UserBetInHistoryDto {
    userId:        string;
    userName:      string;
    placedAt:      string;
    selections:    BetSelectionDto[];
    baseReward:    number;   // +200 sempre
    betEarnings:   number;   // soma dos FichasEarned (pode ser negativo)
    totalForMatch: number;   // baseReward + betEarnings
}

export interface MatchBetHistoryDto {
    matchId:    string;
    playedAt:   string;
    teamAGoals: number;
    teamBGoals: number;
    userBets:   UserBetInHistoryDto[];
}

// ── Form state types ──────────────────────────────────────────────────────────

export interface SelectionForm {
    category:       BetCategory;
    predictedValue: string;
    fichasWagered:  number;
    // Extras parsed para o UI
    winTeam?:        "TeamA" | "TeamB" | "Draw";
    scoreA?:         number;
    scoreB?:         number;
    playerMatchId?:  string;
    playerCount?:    number;
}
