import { http } from './http';
import type { ApiResponse } from './apiResponse';
import type {
  CreateUserDto, LoginDto, RefreshTokenDto,
  CreateGroupDto, UpdateGroupDto,
  UpsertGroupSettingsDto,
  CreatePlayerDto, UpdatePlayerDto,
  CreateTeamColorDto, UpdateTeamColorDto,
  CreateMatchDto, UpdateMatchDto,
  InviteActionDto, SetMatchColorsRequestDto, AssignTeamsDto,
  TeamGenerationRequestDto, SwapPlayersDto,
  VoteRequestDto, SetScoreRequestDto, AddGoalRequestDto, AddGoalsBulkRequestDto,
  MatchDetailsDto, TeamColorDto, TeamsResultDto, PlayerVisualStatsReport,
  GoalDto,
} from './generated/types';
import type { LikedReplayClipDto, ReplayClipDto } from '../domains/matches/matchTypes';

export const AuthApi = {
  login: (dto: LoginDto) => http.post<ApiResponse<unknown>>('/api/Authentication/login', dto),
  refresh: (dto: RefreshTokenDto) => http.post<ApiResponse<unknown>>('/api/Authentication/refresh-token', dto),
};

export const UsersApi = {
    create: (dto: CreateUserDto) => http.post<ApiResponse<unknown>>('/api/Users', dto),
    get: (userId: string) => http.get<ApiResponse<unknown>>(`/api/Users/${userId}`),

    list: (params?: {
        search?: string;
        status?: number; // 1 Active, 2 Inactive
        role?: number;   // 1 User, 2 Admin, 3 GodMode
        page?: number;
        pageSize?: number;
        includeInactive?: boolean;
    }) => http.get<ApiResponse<unknown[]>>(`/api/Users`, { params }),

    update: (userId: string, dto: any) => http.put<ApiResponse<unknown>>(`/api/Users/${userId}`, dto),

    changePassword: (userId: string, dto: { currentPassword: string; newPassword: string }) =>
        http.put<ApiResponse<null>>(`/api/Users/${userId}/password`, dto),

    inactivate: (userId: string) => http.put<ApiResponse<null>>(`/api/Users/${userId}/inactivate`),
    reactivate: (userId: string) => http.put<ApiResponse<null>>(`/api/Users/${userId}/reactivate`),
};

export const GroupsApi = {
  create: (dto: CreateGroupDto) => http.post<ApiResponse<unknown>>('/api/Groups', dto),
  listAll: () => http.get<ApiResponse<unknown[]>>('/api/Groups'),
  listByAdmin: (adminId: string) => http.get<ApiResponse<unknown[]>>(`/api/Groups/admin/${adminId}`),
  get: (groupId: string) => http.get<ApiResponse<unknown>>(`/api/Groups/${groupId}`),
  update: (groupId: string, dto: UpdateGroupDto) => http.put<ApiResponse<unknown>>(`/api/Groups/${groupId}`, dto),
  remove: (groupId: string) => http.delete<ApiResponse<null>>(`/api/Groups/${groupId}`),
  inactivate: (groupId: string) => http.post<ApiResponse<null>>(`/api/Groups/${groupId}/inactivate`),
  reactivate: (groupId: string) => http.post<ApiResponse<null>>(`/api/Groups/${groupId}/reactivate`),
  addAdmin: (groupId: string, userId: string) => http.post<ApiResponse<null>>(`/api/Groups/${groupId}/admins`, { userId }),
  removeAdmin: (groupId: string, userId: string) => http.delete<ApiResponse<null>>(`/api/Groups/${groupId}/admins/${userId}`),
  addFinanceiro: (groupId: string, userId: string) => http.post<ApiResponse<null>>(`/api/Groups/${groupId}/financeiros`, { userId }),
  removeFinanceiro: (groupId: string, userId: string) => http.delete<ApiResponse<null>>(`/api/Groups/${groupId}/financeiros/${userId}`),
  listByFinanceiro: (financeiroId: string) => http.get<ApiResponse<unknown[]>>(`/api/Groups/financeiro/${financeiroId}`),
  leaveAsCreator: (groupId: string, dto: { transferToUserId?: string; promoteAndTransferUserId?: string; deleteGroup?: boolean }) =>
    http.post<ApiResponse<null>>(`/api/Groups/${groupId}/leave-creator`, dto),
};

export const GroupSettingsApi = {
  get: (groupId: string) => http.get<ApiResponse<unknown>>(`/api/GroupSettings/group/${groupId}`),
  upsert: (groupId: string, dto: UpsertGroupSettingsDto) => http.put<ApiResponse<unknown>>(`/api/GroupSettings/group/${groupId}`, dto),
};

export const PlayersApi = {
  create: (dto: CreatePlayerDto) => http.post<ApiResponse<unknown>>('/api/Players', dto),
  get: (playerId: string) => http.get<ApiResponse<unknown>>(`/api/Players/${playerId}`),
  update: (playerId: string, dto: UpdatePlayerDto) => http.put<ApiResponse<unknown>>(`/api/Players/${playerId}`, dto),
  remove: (playerId: string) => http.delete<ApiResponse<null>>(`/api/Players/${playerId}`),
  inactivate: (playerId: string) => http.post<ApiResponse<null>>(`/api/Players/${playerId}/inactivate`),
  reactivate: (playerId: string) => http.post<ApiResponse<null>>(`/api/Players/${playerId}/reactivate`),
  mine: () => http.get<ApiResponse<unknown[]>>("/api/Players/mine"),
  byUser: (userId: string) => http.get<ApiResponse<unknown[]>>(`/api/Players/by-user/${userId}`),
  leaveGroup: (playerId: string) => http.post<ApiResponse<null>>(`/api/Players/${playerId}/leave`),
};

export const TeamColorApi = {
  list: (groupId: string, activeOnly?: boolean) =>
    http.get<ApiResponse<TeamColorDto[]>>(`/api/TeamColor/group/${groupId}`, activeOnly ? { params: { activeOnly: true } } : undefined),
  create: (groupId: string, dto: CreateTeamColorDto) => http.post<ApiResponse<TeamColorDto>>(`/api/TeamColor/group/${groupId}`, dto),
  get: (groupId: string, colorId: string) => http.get<ApiResponse<TeamColorDto>>(`/api/TeamColor/group/${groupId}/${colorId}`),
  update: (groupId: string, colorId: string, dto: UpdateTeamColorDto) => http.put<ApiResponse<TeamColorDto>>(`/api/TeamColor/group/${groupId}/${colorId}`, dto),
  remove: (groupId: string, colorId: string) => http.delete<ApiResponse<null>>(`/api/TeamColor/group/${groupId}/${colorId}`),
  activate: (groupId: string, colorId: string) => http.post<ApiResponse<null>>(`/api/TeamColor/group/${groupId}/${colorId}/activate`),
  deactivate: (groupId: string, colorId: string) => http.post<ApiResponse<null>>(`/api/TeamColor/group/${groupId}/${colorId}/deactivate`),
};

export const MatchesApi = {
  list: (groupId: string) => http.get<ApiResponse<MatchDetailsDto[]>>(`/api/Matches/group/${groupId}`),
  get: (groupId: string, matchId: string) => http.get<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}`),
  create: (groupId: string, dto: CreateMatchDto) => http.post<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}`, dto),
  update: (groupId: string, matchId: string, dto: UpdateMatchDto) => http.put<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}`, dto),
  remove: (groupId: string, matchId: string) => http.delete<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}`),
  syncPlayers: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/players/sync`),
  accept: (groupId: string, matchId: string, dto: InviteActionDto) => http.patch<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/invite/accept`, dto),
  reject: (groupId: string, matchId: string, dto: InviteActionDto) => http.patch<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/invite/reject`, dto),
  setColors: (groupId: string, matchId: string, dto: SetMatchColorsRequestDto) => http.patch<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}/colors`, dto),
  start: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/start`),
  end: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/end`),
  vote: (groupId: string, matchId: string, dto: VoteRequestDto) => http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/vote`, dto),
  setMvp: (groupId: string, matchId: string) => http.get<ApiResponse<unknown>>(`/api/Matches/group/${groupId}/${matchId}/mvp`),
  setScore: (groupId: string, matchId: string, dto: SetScoreRequestDto) => http.patch<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}/score`, dto),
  addGoal: (groupId: string, matchId: string, dto: AddGoalRequestDto) => http.post<ApiResponse<GoalDto>>(`/api/Matches/group/${groupId}/${matchId}/goals`, dto),
  addGoalsBulk: (groupId: string, matchId: string, dto: AddGoalsBulkRequestDto) => http.post<ApiResponse<GoalDto[]>>(`/api/Matches/group/${groupId}/${matchId}/goals/bulk`, dto),
  updateGoal: (groupId: string, matchId: string, goalId: string, dto: { scorerPlayerId: string; assistPlayerId?: string | null; time?: string | null; isOwnGoal?: boolean }) =>
    http.put<ApiResponse<GoalDto>>(`/api/Matches/group/${groupId}/${matchId}/goals/${goalId}`, dto),
  deleteGoal: (groupId: string, matchId: string, goalId: string) => http.delete<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/goals/${goalId}`),
  assignTeams: (groupId: string, matchId: string, dto: AssignTeamsDto) => http.put<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}/teams`, dto),
  swap: (groupId: string, matchId: string, dto: SwapPlayersDto) => http.post<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}/swap`, dto),
  finalize: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/finalize`),
  reapplyMvp: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/reapply-mvp`),
  details: (groupId: string, matchId: string) => http.get<ApiResponse<MatchDetailsDto>>(`/api/Matches/group/${groupId}/${matchId}/details`),
  goToMatchMaking: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/matches/group/${groupId}/${matchId}/matchmaking`),
  goToPostGame: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/matches/group/${groupId}/${matchId}/postgame`),
  removeGoal: (groupId: string, matchId: string, goalId: string) => http.delete<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/goals/${goalId}`),
  getCurrent: (groupId: string) => http.get<ApiResponse<MatchDetailsDto>>(`/api/matches/group/${groupId}/current`),
  rewind: (groupId: string, matchId: string) => http.post<ApiResponse<null>>(`/api/matches/group/${groupId}/${matchId}/rewind`),
  header: (groupId: string, matchId: string) => http.get<ApiResponse<unknown>>(`/api/matches/group/${groupId}/${matchId}/header`),
  acceptation: (groupId: string, matchId: string) => http.get<ApiResponse<unknown>>(`/api/matches/group/${groupId}/${matchId}/acceptation`),
  matchmaking: (groupId: string, matchId: string) => http.get<ApiResponse<unknown>>(`/api/matches/group/${groupId}/${matchId}/matchmaking`),
  postgame: (groupId: string, matchId: string) => http.get<ApiResponse<unknown>>(`/api/matches/group/${groupId}/${matchId}/postgame`),
  history: (groupId: string, take: number, playerId?: string) => http.get<ApiResponse<MatchDetailsDto[]>>(`/api/Matches/group/${groupId}/history`, { params: { take, ...(playerId ? { playerId } : {}) } }),
  playerRecent: (groupId: string, playerId: string, take = 3) => http.get<ApiResponse<MatchDetailsDto[]>>(`/api/Matches/group/${groupId}/player-recent`, { params: { playerId, take } }),
  addGuest: (groupId: string, matchId: string, dto: { name: string; isGoalkeeper: boolean; guestStarRating?: number | null }) =>
    http.post<ApiResponse<unknown>>(`/api/Matches/group/${groupId}/${matchId}/guests`, dto),
  publishEvent: (groupId: string, matchId: string, dto: { type: 'Gol' | 'Jogada'; durationSeconds?: number }) =>
    http.post<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/events`, dto),
  setPlayerRole: (
    groupId: string, matchId: string, matchPlayerId: string,
    dto: { isGoalkeeper: boolean }
  ) => http.patch<ApiResponse<null>>(`/api/Matches/group/${groupId}/${matchId}/players/${matchPlayerId}/role`, dto),
  replays: (groupId: string, matchId: string) =>
    http.get<ApiResponse<ReplayClipDto[]>>(`/api/Matches/group/${groupId}/${matchId}/replays`),
  downloadReplay: (groupId: string, clipId: string) =>
    http.get(`/api/Matches/group/${groupId}/replays/${clipId}/download`, { responseType: "blob" }),
  toggleLike: (groupId: string, clipId: string) =>
    http.post<{ isLiked: boolean; likeCount: number }>(`/api/Matches/group/${groupId}/replays/${clipId}/like`),
  toggleFavorite: (groupId: string, clipId: string) =>
    http.post<{ isFavorited: boolean }>(`/api/Matches/group/${groupId}/replays/${clipId}/favorite`),
  allReplays: (groupId: string) =>
    http.get<ApiResponse<LikedReplayClipDto[]>>(`/api/Matches/group/${groupId}/replays/all`),
  likedReplays: (groupId: string) =>
    http.get<ApiResponse<LikedReplayClipDto[]>>(`/api/Matches/group/${groupId}/replays/liked`),
  myLikes: (groupId: string) =>
    http.get<ApiResponse<LikedReplayClipDto[]>>(`/api/Matches/group/${groupId}/replays/my-likes`),
  myFavorites: (groupId: string) =>
    http.get<ApiResponse<LikedReplayClipDto[]>>(`/api/Matches/group/${groupId}/replays/my-favorites`),
  deleteReplay: (groupId: string, clipId: string) =>
    http.delete(`/api/Matches/group/${groupId}/replays/${clipId}`),
};

export const BetApi = {
    getCurrentContext: (groupId: string) =>
        http.get(`/api/Bet/group/${groupId}/current`),
    placeOrUpdateBet: (groupId: string, matchId: string, dto: { selections: { category: string; predictedValue: string; fichasWagered: number }[] }) =>
        http.post(`/api/Bet/group/${groupId}/match/${matchId}`, dto),
    getMatchResults: (groupId: string, matchId: string) =>
        http.get(`/api/Bet/group/${groupId}/match/${matchId}/results`),
    getLeaderboard: (groupId: string) =>
        http.get(`/api/Bet/group/${groupId}/leaderboard`),
    getMyBalance: (groupId: string) =>
        http.get<{ balance: number }>(`/api/Bet/group/${groupId}/balance`),
    getHistory: (groupId: string) =>
        http.get(`/api/Bet/group/${groupId}/history`),
    deleteBet: (groupId: string, matchId: string) =>
        http.delete(`/api/Bet/group/${groupId}/match/${matchId}`),
    getPreview: (groupId: string, matchId: string) =>
        http.get(`/api/Bet/group/${groupId}/match/${matchId}/preview`),
};

export const GroupInvitesApi = {
  create: (groupId: string, dto: { targetUserId: string; guestPlayerId?: string | null }) =>
    http.post<ApiResponse<unknown>>(`/api/Groups/${groupId}/invites`, dto),
  mine: () => http.get<ApiResponse<unknown[]>>('/api/Groups/invites/mine'),
  mineCount: () => http.get<ApiResponse<unknown>>('/api/Groups/invites/mine/count'),
  accept: (inviteId: string) => http.patch<ApiResponse<null>>(`/api/Groups/invites/${inviteId}/accept`),
  reject: (inviteId: string) => http.patch<ApiResponse<null>>(`/api/Groups/invites/${inviteId}/reject`),
};

export const TeamGenApi = {
  generate:    (dto: TeamGenerationRequestDto) => http.post<ApiResponse<TeamsResultDto>>(`/api/TeamGeneration/generate`, dto),
  visualStats: (groupId: string) => http.get<ApiResponse<PlayerVisualStatsReport>>(`/api/TeamGeneration/visual-stats/${groupId}`),
  spotlight:   (groupId: string) => http.get<ApiResponse<unknown>>(`/api/TeamGeneration/spotlight/${groupId}`),
};

export type AbsenceDto = {
  id: string;
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;      // "YYYY-MM-DD"
  absenceType: number;
  absenceTypeName: string;
  description?: string | null;
  createdAt: string;
};

export type CreateAbsenceDto = {
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;      // "YYYY-MM-DD"
  absenceType: number;
  description?: string | null;
};

export const AbsencesApi = {
  mine: () =>
    http.get<ApiResponse<AbsenceDto[]>>('/api/absences/mine'),

  create: (dto: CreateAbsenceDto) =>
    http.post<ApiResponse<AbsenceDto>>('/api/absences', dto),

  update: (id: string, dto: CreateAbsenceDto) =>
    http.put<ApiResponse<AbsenceDto>>(`/api/absences/${id}`, dto),

  delete: (id: string) =>
    http.delete<ApiResponse<null>>(`/api/absences/${id}`),

  byGroup: (groupId: string) =>
    http.get<ApiResponse<unknown[]>>(`/api/absences/group/${groupId}`),
};

export const CalendarApi = {
  events:         (groupId: string, start: string, end: string) =>
                    http.get<ApiResponse<unknown[]>>(`/api/Calendar/group/${groupId}?start=${start}&end=${end}`),
  createEvent:    (groupId: string, dto: any) =>
                    http.post<ApiResponse<unknown>>(`/api/Calendar/group/${groupId}/events`, dto),
  updateEvent:    (groupId: string, id: string, dto: any) =>
                    http.put<ApiResponse<unknown>>(`/api/Calendar/group/${groupId}/events/${id}`, dto),
  deleteEvent:    (groupId: string, id: string) =>
                    http.delete<ApiResponse<null>>(`/api/Calendar/group/${groupId}/events/${id}`),
  categories:     (groupId: string) =>
                    http.get<ApiResponse<unknown[]>>(`/api/Calendar/group/${groupId}/categories`),
  createCategory: (groupId: string, dto: any) =>
                    http.post<ApiResponse<unknown>>(`/api/Calendar/group/${groupId}/categories`, dto),
  updateCategory: (groupId: string, id: string, dto: any) =>
                    http.put<ApiResponse<unknown>>(`/api/Calendar/group/${groupId}/categories/${id}`, dto),
  deleteCategory: (groupId: string, id: string) =>
                    http.delete<ApiResponse<null>>(`/api/Calendar/group/${groupId}/categories/${id}`),
};

export const PollsApi = {
  getPolls:              (groupId: string) =>
                           http.get(`/api/Polls/group/${groupId}`),
  getPoll:               (groupId: string, pollId: string) =>
                           http.get(`/api/Polls/group/${groupId}/${pollId}`),
  createPoll:            (groupId: string, dto: any) =>
                           http.post(`/api/Polls/group/${groupId}`, dto),
  createEventPoll:       (groupId: string, dto: any) =>
                           http.post(`/api/Polls/group/${groupId}/event`, dto),
  closePoll:             (groupId: string, pollId: string, dto: any) =>
                           http.post(`/api/Polls/group/${groupId}/${pollId}/close`, dto),
  reopenPoll:            (groupId: string, pollId: string) =>
                           http.put(`/api/Polls/group/${groupId}/${pollId}/reopen`),
  setShowVotes:          (groupId: string, pollId: string, showVotes: boolean) =>
                           http.patch(`/api/Polls/group/${groupId}/${pollId}/show-votes`, { showVotes }),
  deletePoll:            (groupId: string, pollId: string) =>
                           http.delete(`/api/Polls/group/${groupId}/${pollId}`),
  addOption:             (groupId: string, pollId: string, dto: any) =>
                           http.post(`/api/Polls/group/${groupId}/${pollId}/options`, dto),
  updateOption:          (groupId: string, pollId: string, optionId: string, dto: any) =>
                           http.put(`/api/Polls/group/${groupId}/${pollId}/options/${optionId}`, dto),
  deleteOption:          (groupId: string, pollId: string, optionId: string) =>
                           http.delete(`/api/Polls/group/${groupId}/${pollId}/options/${optionId}`),
  castVote:              (groupId: string, pollId: string, dto: any) =>
                           http.post(`/api/Polls/group/${groupId}/${pollId}/vote`, dto),
  removeVote:            (groupId: string, pollId: string) =>
                           http.delete(`/api/Polls/group/${groupId}/${pollId}/vote`),
  adminCastVote:         (groupId: string, pollId: string, dto: { playerId: string; optionIds: string[] }) =>
                           http.post(`/api/Polls/group/${groupId}/${pollId}/admin-vote`, dto),
};

export const PaymentsApi = {
  // Mensalidades
  getMonthlyGrid:     (groupId: string, year: number) =>
                        http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/monthly/${year}`),
  upsertMonthly:      (groupId: string, dto: any) =>
                        http.put<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/monthly`, dto),
  initiateMonthly:    (groupId: string, year: number, month: number) =>
                        http.post<ApiResponse<null>>(`/api/groups/${groupId}/payments/monthly/${year}/${month}/initiate`),
  isMonthInitiated:   (groupId: string, year: number, month: number) =>
                        http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/monthly/${year}/${month}/is-initiated`),
  getMonthlyProof:    (groupId: string, playerId: string, year: number, month: number) =>
                        http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/monthly/${year}/${month}/${playerId}/proof`),

  // Cobranças extras
  getExtraCharges:           (groupId: string) =>
                               http.get<ApiResponse<unknown[]>>(`/api/groups/${groupId}/payments/extra-charges`),
  createExtraCharge:         (groupId: string, dto: any) =>
                               http.post<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/extra-charges`, dto),
  cancelExtraCharge:         (groupId: string, chargeId: string) =>
                               http.delete<ApiResponse<null>>(`/api/groups/${groupId}/payments/extra-charges/${chargeId}`),
  bulkDiscountExtraCharge:   (groupId: string, chargeId: string, dto: any) =>
                               http.post<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/extra-charges/${chargeId}/bulk-discount`, dto),
  upsertExtraChargePayment:  (groupId: string, chargeId: string, playerId: string, dto: any) =>
                               http.put<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/extra-charges/${chargeId}/players/${playerId}`, dto),
  getExtraChargeProof:       (groupId: string, chargeId: string, playerId: string) =>
                               http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/extra-charges/${chargeId}/${playerId}/proof`),

  // Resumo
  getMySummary:         (groupId: string) =>
                          http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/my`),
  getSummaryForPlayer:  (groupId: string, playerId: string) =>
                          http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/summary/${playerId}`),
  getMyMonthlyRow:      (groupId: string, year: number) =>
                          http.get<ApiResponse<unknown>>(`/api/groups/${groupId}/payments/monthly/${year}/me`),
  getMyExtraCharges:    (groupId: string) =>
                          http.get<ApiResponse<unknown[]>>(`/api/groups/${groupId}/payments/extra-charges/me`),
};

export const MatchCardApi = {
  generate: (groupId: string, dto: {
    template: 'match_preview' | 'match_result';
    teamAName: string;
    teamAColorHex: string;
    teamAPlayers: { name: string; isGoalkeeper: boolean }[];
    teamBName: string;
    teamBColorHex: string;
    teamBPlayers: { name: string; isGoalkeeper: boolean }[];
    playedAt?: string;
    teamAGoals?: number;
    teamBGoals?: number;
    mvpName?: string;
    winnerTeamName?: string;
  }) => http.post<ApiResponse<string>>(`/api/MatchCard/group/${groupId}/generate`, dto),
};
