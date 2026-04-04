import type { PacienteMedicamento } from "../types/paciente";

export function normalizeRegimeConsumo(
  m: Pick<PacienteMedicamento, "regime_consumo">,
): "diario" | "por_ciclo" {
  return m.regime_consumo === "por_ciclo" ? "por_ciclo" : "diario";
}

export function taxaUnidadesPorDiaFromMedicamento(m: PacienteMedicamento): number {
  if (normalizeRegimeConsumo(m) === "por_ciclo") {
    const u = Number(m.unidades_por_ciclo);
    const d = Number(m.intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return 0;
    return u / d;
  }
  const c = Number(m.consumo_diario);
  return Number.isFinite(c) && c > 0 ? c : 0;
}

/** Texto curto para listagens (ex.: "2/dia" ou "1 unid. / 45 dias"). */
export function usoMedicamentoResumo(m: PacienteMedicamento): string {
  if (normalizeRegimeConsumo(m) === "por_ciclo") {
    const u = m.unidades_por_ciclo;
    const d = m.intervalo_ciclo_dias;
    if (u != null && d != null) return `${u} unid. / ${d} dias`;
    return "por ciclo";
  }
  return `${m.consumo_diario}/dia`;
}
