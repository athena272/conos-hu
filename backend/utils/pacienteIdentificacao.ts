import type { UserRole } from "../types/roles";
import { isElevated } from "./permissions";

const NOME_REDACT = "Identificação restrita";
/** Sentinela: prontuário real é não negativo; -1 indica redação para viewer. */
export const PRONTUARIO_REDACT_SENTINEL = -1;

export function redactPacienteIdentificacao<T extends { nome: string; prontuario: number }>(
  row: T,
  role: UserRole | undefined,
): T & { identificadoresRedatados: boolean } {
  if (isElevated(role)) {
    return { ...row, identificadoresRedatados: false };
  }
  return {
    ...row,
    nome: NOME_REDACT,
    prontuario: PRONTUARIO_REDACT_SENTINEL,
    identificadoresRedatados: true,
  };
}
