import {
  canWriteMedications,
  canWritePacientes,
  isElevated,
  isUserRole,
  type UserRole,
} from "./permissions";

export type { UserRole };

const AUTH_KEY = "auth";

export interface AuthSession {
  token: string;
  userId: number;
  email: string;
  role: UserRole;
  operadorNome?: string;
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
      isUserRole(p.role)
    ) {
      const session: AuthSession = {
        token: p.token,
        userId: p.userId,
        email: p.email,
        role: p.role,
      };
      if (typeof p.operadorNome === "string" && p.operadorNome.trim()) {
        session.operadorNome = p.operadorNome.trim();
      }
      return session;
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

export function sessionIsElevated(): boolean {
  return isElevated(getAuth()?.role);
}

export function sessionCanWriteMedications(): boolean {
  return canWriteMedications(getAuth()?.role);
}

export function sessionCanWritePacientes(): boolean {
  return canWritePacientes(getAuth()?.role);
}

/** @deprecated Use sessionIsElevated */
export function isAdmin(): boolean {
  return sessionIsElevated();
}

export function needsOperatorIdentify(): boolean {
  const auth = getAuth();
  if (!auth) return false;
  return isElevated(auth.role) && !auth.operadorNome;
}

export { isElevated, canWriteMedications, canWritePacientes };
