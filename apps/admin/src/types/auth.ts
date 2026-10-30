import { User } from './users';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface AuthRequest {
  email: string;
  password: string;
}
