import { http } from './http';
import type {
  CreateUserDto, LoginDto, RefreshTokenDto,
  CreateGroupDto, UpdateGroupDto,
  UpsertGroupSettingsDto,
  CreatePlayerDto, UpdatePlayerDto,
  CreateTeamColorDto, UpdateTeamColorDto,
  CreateMatchDto, UpdateMatchDto,
  InviteActionDto, SetMatchColorsRequestDto, AssignTeamsDto,
  TeamGenerationRequestDto, SwapPlayersDto,
  VoteRequestDto, SetScoreRequestDto, AddGoalRequestDto, AddGoalsBulkRequestDto
} from './generated/types';

export const AuthApi = {
  login: (dto: LoginDto) => http.post('/api/Authentication/login', dto),
  refresh: (dto: RefreshTokenDto) => http.post('/api/Authentication/refresh-token', dto),
};

export const UsersApi = {
    create: (dto: CreateUserDto) => http.post('/api/Users', dto),
    get: (userId: string) => http.get(`/api/Users/${userId}`),

    list: (params?: {
        search?: string;
        status?: number; // 1 Active, 2 Inactive
        role?: number;   // 1 User, 2 Admin, 3 GodMode
        page?: number;
        pageSize?: number;
        includeInactive?: boolean;
    }) => http.get(`/api/Users`, { params }),

    update: (userId: string, dto: any) => http.put(`/api/Users/${userId}`, dto),

    changePassword: (userId: string, dto: { currentPassword: string; newPassword: string }) =>
        http.put(`/api/Users/${userId}/password`, dto),

    inactivate: (userId: string) => http.put(`/api/Users/${userId}/inactivate`),
    reactivate: (userId: string) => http.put(`/api/Users/${userId}/reactivate`),
};

export const GroupsApi = {
  create: (dto: CreateGroupDto) => http.post('/api/Groups', dto),
  listAll: () => http.get('/api/Groups'),
  listByAdmin: (adminId: string) => http.get(`/api/Groups/admin/${adminId}`),
  get: (groupId: string) => http.get(`/api/Groups/${groupId}`),
  update: (groupId: string, dto: UpdateGroupDto) => http.put(`/api/Groups/${groupId}`, dto),
  remove: (groupId: string) => http.delete(`/api/Groups/${groupId}`),
  inactivate: (groupId: string) => http.post(`/api/Groups/${groupId}/inactivate`),
  reactivate: (groupId: string) => http.post(`/api/Groups/${groupId}/reactivate`),
  addAdmin: (groupId: string, userId: string) => http.post(`/api/Groups/${groupId}/admins`, { userId }),
  removeAdmin: (groupId: string, userId: string) => http.delete(`/api/Groups/${groupId}/admins/${userId}`),
  leaveAsCreator: (groupId: string, dto: { transferToUserId?: string; promoteAndTransferUserId?: string; deleteGroup?: boolean }) =>
    http.post(`/api/Groups/${groupId}/leave-creator`, dto),
};

export const GroupSettingsApi = {
  get: (groupId: string) => http.get(`/api/GroupSettings/group/${groupId}`),
  upsert: (groupId: string, dto: UpsertGroupSettingsDto) => http.put(`/api/GroupSettings/group/${groupId}`, dto),
};

export const PlayersApi = {
  create: (dto: CreatePlayerDto) => http.post('/api/Players', dto),
  get: (playerId: string) => http.get(`/api/Players/${playerId}`),
  update: (playerId: string, dto: UpdatePlayerDto) => http.put(`/api/Players/${playerId}`, dto),
  remove: (playerId: string) => http.delete(`/api/Players/${playerId}`),
  inactivate: (playerId: string) => http.post(`/api/Players/${playerId}/inactivate`),
  reactivate: (playerId: string) => http.post(`/api/Players/${playerId}/reactivate`),
  mine: () => http.get("/api/Players/mine"),
  byUser: (userId: string) => http.get(`/api/Players/by-user/${userId}`),
  leaveGroup: (playerId: string) => http.post(`/api/Players/${playerId}/leave`),
};

export const TeamColorApi = {
  list: (groupId: string, activeOnly?: boolean) =>
    http.get(`/api/TeamColor/group/${groupId}`, activeOnly ? { params: { activeOnly: true } } : undefined),
  create: (groupId: string, dto: CreateTeamColorDto) => http.post(`/api/TeamColor/group/${groupId}`, dto),
  get: (groupId: string, colorId: string) => http.get(`/api/TeamColor/group/${groupId}/${colorId}`),
  update: (groupId: string, colorId: string, dto: UpdateTeamColorDto) => http.put(`/api/TeamColor/group/${groupId}/${colorId}`, dto),
  remove: (groupId: string, colorId: string) => http.delete(`/api/TeamColor/group/${groupId}/${colorId}`),
  activate: (groupId: string, colorId: string) => http.post(`/api/TeamColor/group/${groupId}/${colorId}/activate`),
  deactivate: (groupId: string, colorId: string) => http.post(`/api/TeamColor/group/${groupId}/${colorId}/deactivate`),
};

export const MatchesApi = {
  list: (groupId: string) => http.get(`/api/Matches/group/${groupId}`),
  get: (groupId: string, matchId: string) => http.get(`/api/Matches/group/${groupId}/${matchId}`),
  create: (groupId: string, dto: CreateMatchDto) => http.post(`/api/Matches/group/${groupId}`, dto),
  update: (groupId: string, matchId: string, dto: UpdateMatchDto) => http.put(`/api/Matches/group/${groupId}/${matchId}`, dto),
  remove: (groupId: string, matchId: string) => http.delete(`/api/Matches/group/${groupId}/${matchId}`),
  syncPlayers: (groupId: string, matchId: string) => http.post(`/api/Matches/group/${groupId}/${matchId}/players/sync`),
  accept: (groupId: string, matchId: string, dto: InviteActionDto) => http.patch(`/api/Matches/group/${groupId}/${matchId}/invite/accept`, dto),
  reject: (groupId: string, matchId: string, dto: InviteActionDto) => http.patch(`/api/Matches/group/${groupId}/${matchId}/invite/reject`, dto),
  setColors: (groupId: string, matchId: string, dto: SetMatchColorsRequestDto) => http.patch(`/api/Matches/group/${groupId}/${matchId}/colors`, dto),
  start: (groupId: string, matchId: string) => http.post(`/api/Matches/group/${groupId}/${matchId}/start`),
  end: (groupId: string, matchId: string) => http.post(`/api/Matches/group/${groupId}/${matchId}/end`),
  vote: (groupId: string, matchId: string, dto: VoteRequestDto) => http.post(`/api/Matches/group/${groupId}/${matchId}/vote`, dto),
  setMvp: (groupId: string, matchId: string) => http.get(`/api/Matches/group/${groupId}/${matchId}/mvp`),
  setScore: (groupId: string, matchId: string, dto: SetScoreRequestDto) => http.patch(`/api/Matches/group/${groupId}/${matchId}/score`, dto),
  addGoal: (groupId: string, matchId: string, dto: AddGoalRequestDto) => http.post(`/api/Matches/group/${groupId}/${matchId}/goals`, dto),
  addGoalsBulk: (groupId: string, matchId: string, dto: AddGoalsBulkRequestDto) => http.post(`/api/Matches/group/${groupId}/${matchId}/goals/bulk`, dto),
  updateGoal: (groupId: string, matchId: string, goalId: string, dto: { scorerPlayerId: string; assistPlayerId?: string | null; time?: string | null; isOwnGoal?: boolean }) =>
    http.put(`/api/Matches/group/${groupId}/${matchId}/goals/${goalId}`, dto),
  deleteGoal: (groupId: string, matchId: string, goalId: string) => http.delete(`/api/Matches/group/${groupId}/${matchId}/goals/${goalId}`),
  assignTeams: (groupId: string, matchId: string, dto: AssignTeamsDto) => http.put(`/api/Matches/group/${groupId}/${matchId}/teams`, dto),
  swap: (groupId: string, matchId: string, dto: SwapPlayersDto) => http.post(`/api/Matches/group/${groupId}/${matchId}/swap`, dto),
  finalize: (groupId: string, matchId: string) => http.post(`/api/Matches/group/${groupId}/${matchId}/finalize`),
  details: (groupId: string, matchId: string) => http.get(`/api/Matches/group/${groupId}/${matchId}/details`),
  goToMatchMaking: (groupId: string, matchId: string) => http.post(`/api/matches/group/${groupId}/${matchId}/matchmaking`),
  goToPostGame: (groupId: string, matchId: string) => http.post(`/api/matches/group/${groupId}/${matchId}/postgame`),
  removeGoal: (groupId: string, matchId: string, goalId: string) => http.delete(`/matches/group/${groupId}/${matchId}/goals/${goalId}`),
  getCurrent: (groupId: string) => http.get(`/api/matches/group/${groupId}/current`),
  rewind: (groupId: string, matchId: string) => http.post(`/api/matches/group/${groupId}/${matchId}/rewind`),
  header: (groupId: string, matchId: string) => http.get(`/api/matches/group/${groupId}/${matchId}/header`),
  acceptation: (groupId: string, matchId: string) => http.get(`/api/matches/group/${groupId}/${matchId}/acceptation`),
  matchmaking: (groupId: string, matchId: string) => http.get(`/api/matches/group/${groupId}/${matchId}/matchmaking`),
  postgame: (groupId: string, matchId: string) => http.get(`/api/matches/group/${groupId}/${matchId}/postgame`),
  history: (groupId: string, take: number, playerId?: string) => http.get(`/api/Matches/group/${groupId}/history`, { params: { take, ...(playerId ? { playerId } : {}) } }),
  addGuest: (groupId: string, matchId: string, dto: { name: string; isGoalkeeper: boolean; guestStarRating?: number | null }) =>
    http.post(`/api/Matches/group/${groupId}/${matchId}/guests`, dto),
  setPlayerRole: (
    groupId: string, matchId: string, matchPlayerId: string,
    dto: { isGoalkeeper: boolean }
  ) => http.patch(`/api/Matches/group/${groupId}/${matchId}/players/${matchPlayerId}/role`, dto),
};

export const GroupInvitesApi = {
  create: (groupId: string, dto: { targetUserId: string; guestPlayerId?: string | null }) =>
    http.post(`/api/Groups/${groupId}/invites`, dto),
  mine: () => http.get('/api/Groups/invites/mine'),
  mineCount: () => http.get('/api/Groups/invites/mine/count'),
  accept: (inviteId: string) => http.patch(`/api/Groups/invites/${inviteId}/accept`),
  reject: (inviteId: string) => http.patch(`/api/Groups/invites/${inviteId}/reject`),
};

export const TeamGenApi = {
  generate: (dto: TeamGenerationRequestDto) => http.post(`/api/TeamGeneration/generate`, dto),
  visualStats: (groupId: string) => http.get(`/api/TeamGeneration/visual-stats/${groupId}`),
};

export const CalendarApi = {
  events:         (groupId: string, start: string, end: string) =>
                    http.get(`/api/Calendar/group/${groupId}?start=${start}&end=${end}`),
  createEvent:    (groupId: string, dto: any) =>
                    http.post(`/api/Calendar/group/${groupId}/events`, dto),
  updateEvent:    (groupId: string, id: string, dto: any) =>
                    http.put(`/api/Calendar/group/${groupId}/events/${id}`, dto),
  deleteEvent:    (groupId: string, id: string) =>
                    http.delete(`/api/Calendar/group/${groupId}/events/${id}`),
  categories:     (groupId: string) =>
                    http.get(`/api/Calendar/group/${groupId}/categories`),
  createCategory: (groupId: string, dto: any) =>
                    http.post(`/api/Calendar/group/${groupId}/categories`, dto),
  updateCategory: (groupId: string, id: string, dto: any) =>
                    http.put(`/api/Calendar/group/${groupId}/categories/${id}`, dto),
  deleteCategory: (groupId: string, id: string) =>
                    http.delete(`/api/Calendar/group/${groupId}/categories/${id}`),
};

export const PaymentsApi = {
  // Mensalidades
  getMonthlyGrid:     (groupId: string, year: number) =>
                        http.get(`/api/groups/${groupId}/payments/monthly/${year}`),
  upsertMonthly:      (groupId: string, dto: any) =>
                        http.put(`/api/groups/${groupId}/payments/monthly`, dto),
  initiateMonthly:    (groupId: string, year: number, month: number) =>
                        http.post(`/api/groups/${groupId}/payments/monthly/${year}/${month}/initiate`),
  isMonthInitiated:   (groupId: string, year: number, month: number) =>
                        http.get(`/api/groups/${groupId}/payments/monthly/${year}/${month}/is-initiated`),
  getMonthlyProof:    (groupId: string, playerId: string, year: number, month: number) =>
                        http.get(`/api/groups/${groupId}/payments/monthly/${year}/${month}/${playerId}/proof`),

  // Cobranças extras
  getExtraCharges:           (groupId: string) =>
                               http.get(`/api/groups/${groupId}/payments/extra-charges`),
  createExtraCharge:         (groupId: string, dto: any) =>
                               http.post(`/api/groups/${groupId}/payments/extra-charges`, dto),
  cancelExtraCharge:         (groupId: string, chargeId: string) =>
                               http.delete(`/api/groups/${groupId}/payments/extra-charges/${chargeId}`),
  bulkDiscountExtraCharge:   (groupId: string, chargeId: string, dto: any) =>
                               http.post(`/api/groups/${groupId}/payments/extra-charges/${chargeId}/bulk-discount`, dto),
  upsertExtraChargePayment:  (groupId: string, chargeId: string, playerId: string, dto: any) =>
                               http.put(`/api/groups/${groupId}/payments/extra-charges/${chargeId}/players/${playerId}`, dto),
  getExtraChargeProof:       (groupId: string, chargeId: string, playerId: string) =>
                               http.get(`/api/groups/${groupId}/payments/extra-charges/${chargeId}/${playerId}/proof`),

  // Resumo
  getMySummary:         (groupId: string) =>
                          http.get(`/api/groups/${groupId}/payments/my`),
  getSummaryForPlayer:  (groupId: string, playerId: string) =>
                          http.get(`/api/groups/${groupId}/payments/summary/${playerId}`),
  getMyMonthlyRow:      (groupId: string, year: number) =>
                          http.get(`/api/groups/${groupId}/payments/monthly/${year}/me`),
  getMyExtraCharges:    (groupId: string) =>
                          http.get(`/api/groups/${groupId}/payments/extra-charges/me`),
};
