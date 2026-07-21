export type UserRole =
  | "admin"
  | "admin_medicamentos"
  | "admin_pacientes"
  | "viewer";

export interface User {
  id: number;
  email: string;
  role: UserRole;
  operador_nome?: string;
}

export interface LoginResponse {
  message: string;
  userId: number;
  email: string;
  role: UserRole;
  token: string;
  operador_nome?: string;
}

export interface RegisterResponse {
  message: string;
  userId: number;
  email: string;
  role: UserRole;
  token: string;
}

export interface IdentifyResponse {
  message: string;
  userId: number;
  email: string;
  role: UserRole;
  operador_nome: string;
  token: string;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
}
