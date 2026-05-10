export type UserRole = 'student' | 'admin' | 'staff';

export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}
