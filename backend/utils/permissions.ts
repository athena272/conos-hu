import type { UserRole } from "../types/roles";

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

/** @deprecated Use isElevated — mantido para compatibilidade interna. */
export function isAdminRole(role: UserRole | undefined): boolean {
  return isElevated(role);
}
