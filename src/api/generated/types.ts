/* AUTO-GENERATED from swagger.json (OpenAPI 3.0). */
/* You can re-generate by updating swagger.json and running a small generator script. */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Status = 1 | 2;
export type StrategyType = 1 | 2 | 3 | 4;

export interface AddGoalRequestDto {
  scorerPlayerId?: string;
  assistPlayerId?: string;
  time?: string;
}

export interface AddGoalsBulkRequestDto {
  goals?: AddGoalRequestDto[];
}

export interface AssignTeamsDto {
    TeamAMatchPlayerIds?: string[];
    TeamBMatchPlayerIds?: string[];
}

export interface CreateGroupDto {
  name?: string;
  userAdminIds?: string[];
  scheduleMatchDate?: string;
}

export interface CreateMatchDto {
  playedAt?: string;
  placeName?: string;
}

export interface CreatePlayerDto {
  name?: string;
  groupId?: string;
  userId?: string;
  skillPoints?: number;
  isGoalkeeper?: boolean;
  status?: Status;
}

export interface CreateTeamColorDto {
  groupId?: string;
  name?: string;
  hexValue?: string;
}

export interface CreateUserDto {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  birthDate?: string;
}

export interface GoalDto {
  goalId?: string;
  scorerPlayerId?: string;
  scorerMatchPlayerId?: string;
  scorerName?: string;
  assistPlayerId?: string;
  assistMatchPlayerId?: string;
  assistName?: string;
  timeSeconds?: number;
  time?: string;
}

export interface InviteActionDto {
  playerId?: string;
}

export interface LoginDto {
  username?: string;
  password?: string;
}

export interface MatchDetailsDto {
  matchId?: string;
  groupId?: string;
  groupName?: string;
  playedAt?: string;
  placeName?: string;
  status?: number;
  statusName?: string;
  teamAGoals?: number;
  teamBGoals?: number;
  teamAColor?: TeamColorDto;
  teamBColor?: TeamColorDto;
  computedMvp?: MatchMvpDto;
  teamAPlayers?: PlayerInMatchDto[];
  teamBPlayers?: PlayerInMatchDto[];
  unassignedPlayers?: PlayerInMatchDto[];
  votes?: VoteDto[];
  voteCounts?: VoteCountDto[];
  goals?: GoalDto[];
}

export interface MatchMvpDto {
  matchPlayerId?: string;
  playerId?: string;
  playerName?: string;
  team?: number;
}

export interface PlayerInMatchDto {
  matchPlayerId?: string;
  playerId?: string;
  playerName?: string;
  isGoalkeeper?: boolean;
  team?: number;
  inviteResponse?: number;
}

export interface PlayerRequestDto {
  id?: string;
  name?: string;
  isGoalkeeper?: boolean;
}

export interface PlayerSynergyItem {
  withPlayerId?: string;
  withPlayerName?: string;
  matchesTogether?: number;
  winsTogether?: number;
  winRateTogether?: number;
}

export interface PlayerVisualStatsItem {
  playerId?: string;
  name?: string;
  status?: Status;
  isGoalkeeper?: boolean;
  gamesPlayed?: number;
  wins?: number;
  ties?: number;
  losses?: number;
  winRate?: number;
  mvps?: number;
  synergies?: PlayerSynergyItem[];
}

export interface PlayerVisualStatsReport {
  groupId?: string;
  totalMatchesConsidered?: number;
  totalFinalizedMatches?: number;
  totalMatchesWithScore?: number;
  players?: PlayerVisualStatsItem[];
}

export interface RefreshTokenDto {
  refreshToken?: string;
}

export interface SetMatchColorsRequestDto {
  teamAColorId?: string;
  teamBColorId?: string;
  randomize?: boolean;
}

export interface SetScoreRequestDto {
  teamAGoals?: number;
  teamBGoals?: number;
}

export interface SwapPlayersDto {
  playerAId?: string;
  playerBId?: string;
}

export interface TeamColorDto {
  id?: string;
  groupId?: string;
  isActive?: boolean;
  name?: string;
  hexValue?: string;
}

export interface TeamGenerationRequestDto {
  players?: PlayerRequestDto[];
  strategyType?: StrategyType;
  playersPerTeam?: number;
  includeGoalkeepers?: boolean;
}

export interface TeamsResultDto {
  teamA?: string[];
  teamB?: string[];
  unassigned?: string[];
}

export interface UpdateGroupDto {
  name?: string;
  scheduleMatchDate?: string;
  status?: Status;
}

export interface UpdateMatchDto {
  id?: string;
  playedAt?: string;
  placeName?: string;
}

export interface UpdatePlayerDto {
  name?: string;
  groupId?: string;
  skillPoints?: number;
  isGoalkeeper?: boolean;
  status?: Status;
}

export interface UpdateTeamColorDto {
  name?: string;
  hexValue?: string;
}

export interface UpsertGroupSettingsDto {
  minPlayers?: number;
  maxPlayers?: number;
  defaultPlaceName?: string;
  defaultDayOfWeek?: DayOfWeek;
  defaultKickoffTime?: string;
}

export interface VoteCountDto {
  votedForMatchPlayerId?: string;
  votedForName?: string;
  count?: number;
}

export interface VoteDto {
  voteId?: string;
  voterMatchPlayerId?: string;
  votedForMatchPlayerId?: string;
  voterName?: string;
  votedForName?: string;
}

export interface VoteRequestDto {
  voterPlayerId?: string;
  votedPlayerId?: string;
}