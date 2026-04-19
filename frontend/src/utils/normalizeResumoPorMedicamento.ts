import type { ResumoPorMedicamento, ResumoTaxaTipo } from "../types/paciente";

const TIPOS_VALIDOS: ResumoTaxaTipo[] = [
  "por_ciclo_homogeneo",
  "diario_apenas",
  "agregado",
];

function parseTipo(raw: unknown): ResumoTaxaTipo | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim() as ResumoTaxaTipo;
  return TIPOS_VALIDOS.includes(t) ? t : undefined;
}

function num(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Aceita resposta da API em camelCase ou snake_case (proxies / versões antigas).
 */
export function normalizeResumoPorMedicamentoLista(data: unknown): ResumoPorMedicamento[] {
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x && typeof x === "object").map((x) => normalizeUm(x as Record<string, unknown>));
}

function normalizeUm(r: Record<string, unknown>): ResumoPorMedicamento {
  const base = r as unknown as ResumoPorMedicamento;
  const tipo = parseTipo(r.resumoTaxaTipo) ?? parseTipo(r.resumo_taxa_tipo);
  const porU = num(r.porCicloUnidadesTotal ?? r.por_ciclo_unidades_total);
  const porD = num(r.porCicloIntervaloDias ?? r.por_ciclo_intervalo_dias);
  const consumoAlt = num(r.consumo_diario_total);
  const mgTotal = r.mgAcumuladoDispensadoTotal ?? r.mg_acumulado_dispensado_total;
  const mgNum =
    mgTotal === null || mgTotal === undefined
      ? undefined
      : Number(mgTotal);

  return {
    ...base,
    consumoDiarioTotal:
      base.consumoDiarioTotal ?? consumoAlt ?? 0,
    ...(tipo ? { resumoTaxaTipo: tipo } : {}),
    ...(porU !== undefined ? { porCicloUnidadesTotal: porU } : {}),
    ...(porD !== undefined ? { porCicloIntervaloDias: porD } : {}),
    ...(mgNum !== undefined && Number.isFinite(mgNum)
      ? { mgAcumuladoDispensadoTotal: mgNum }
      : mgTotal === null
        ? { mgAcumuladoDispensadoTotal: null }
        : {}),
  };
}
