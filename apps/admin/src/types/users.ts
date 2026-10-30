export type UserRole = 'admin' | 'manager' | 'user';

export interface User {
  readonly id: number;
  name: string;
  email: string;
  role: UserRole;
  isActivated: boolean;
  dateOfBirth?: string | null;
  phone?: string | null;
}
