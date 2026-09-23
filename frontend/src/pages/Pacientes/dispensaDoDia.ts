import type { RegimeConsumoMedicamento } from "../../types";

export interface DispensaMedicamentoSugestaoInput {
  regime_consumo?: RegimeConsumoMedicamento | string | null;
  unidades_por_ciclo?: string | number | null;
}

/**
 * Sugere quantidade da dispensa do dia a partir da programação por ciclo.
 * Não altera a programação — só for default no formulário.
 */
export function suggestDispensaQuantidade(
  med: DispensaMedicamentoSugestaoInput | null | undefined,
): string {
  if (!med) return "";
  if (med.regime_consumo !== "por_ciclo") return "";
  const raw = med.unidades_por_ciclo;
  if (raw == null || String(raw).trim() === "") return "";
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}
