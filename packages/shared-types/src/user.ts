export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storage_used?: number;
  storage_limit?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserWithToken extends User {
  token?: string;
}
