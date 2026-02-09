export interface User {
  id: number;
  email: string;
}

export interface LoginResponse {
  message: string;
  userId: number;
}

export interface RegisterResponse {
  message: string;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
}
