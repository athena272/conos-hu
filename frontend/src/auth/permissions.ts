export const USER_ROLES = [
  "admin",
  "admin_medicamentos",
  "admin_pacientes",
  "viewer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isElevated(role: UserRole | undefined): boolean {
  return (
    role === "admin" ||
    role === "admin_medicamentos" ||
    role === "admin_pacientes"
  );
}

export function canWriteMedications(role: UserRole | undefined): boolean {
  return role === "admin" || role === "admin_medicamentos";
}

export function canWritePacientes(role: UserRole | undefined): boolean {
  return role === "admin" || role === "admin_pacientes";
}

/** @deprecated Use isElevated */
export function isAdmin(role: UserRole | undefined): boolean {
  return isElevated(role);
}
