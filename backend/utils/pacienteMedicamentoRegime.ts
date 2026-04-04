export type RegimeConsumo = "diario" | "por_ciclo";

export function parseRegimeConsumo(raw: unknown): RegimeConsumo {
  if (raw === "por_ciclo" || raw === "diario") return raw;
  return "diario";
}

/**
 * Taxa média em unidades por dia para agregação de estoque.
 * Modo diário: usa consumo_diario.
 * Modo por ciclo: unidades_por_ciclo / intervalo_ciclo_dias.
 */
export function taxaUnidadesPorDia(
  regime: RegimeConsumo,
  consumo_diario: number,
  unidades_por_ciclo: number | null | undefined,
  intervalo_ciclo_dias: number | null | undefined
): number {
  if (regime === "por_ciclo") {
    const u = Number(unidades_por_ciclo);
    const d = Number(intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return 0;
    return u / d;
  }
  const c = Number(consumo_diario);
  return Number.isFinite(c) && c > 0 ? c : 0;
}

export interface PacienteMedicamentoPersistRow {
  regime_consumo: string | null;
  consumo_diario: number;
  unidades_por_ciclo: number | null;
  intervalo_ciclo_dias: number | null;
}

export function taxaFromPersistRow(row: PacienteMedicamentoPersistRow): number {
  const regime = parseRegimeConsumo(row.regime_consumo);
  return taxaUnidadesPorDia(regime, Number(row.consumo_diario), row.unidades_por_ciclo, row.intervalo_ciclo_dias);
}
