export type Role = 'User' | 'Admin' | 'GodMode';

export interface Account {
  userId: string;
  name: string;
  email?: string;
  roles: Role[];
  accessToken: string;
  refreshToken: string;
  activeGroupId?: string; // per-account selection
  activePlayerId?: string; // optional convenience
}
