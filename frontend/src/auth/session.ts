const AUTH_KEY = "auth";

export type UserRole = "admin" | "viewer";

export interface AuthSession {
  token: string;
  userId: number;
  email: string;
  role: UserRole;
}

export function setAuth(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  localStorage.setItem("userId", String(session.userId));
}

export function getAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof p.token === "string" &&
      typeof p.userId === "number" &&
      typeof p.email === "string" &&
      (p.role === "admin" || p.role === "viewer")
    ) {
      return p as AuthSession;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getToken(): string | null {
  return getAuth()?.token ?? null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem("userId");
  localStorage.removeItem("user");
}

export function isAdmin(): boolean {
  return getAuth()?.role === "admin";
}
