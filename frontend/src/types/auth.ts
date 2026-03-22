export type UserRole = "admin" | "viewer";

export interface User {
  id: number;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  message: string;
  userId: number;
  email: string;
  role: UserRole;
  token: string;
}

export interface RegisterResponse {
  message: string;
  userId: number;
  email: string;
  role: UserRole;
  token: string;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
}
