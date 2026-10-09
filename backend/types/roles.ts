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
