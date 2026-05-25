import { parseMgPorUnidadeFromConcentracao } from "./concentracaoMg";

export type RegimeConsumo = "diario" | "por_ciclo" | "por_miligrama";

function rawRegimeToString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) return raw.toString("utf8").trim();
  return String(raw).trim();
}

export function parseRegimeConsumo(raw: unknown): RegimeConsumo {
  const s = rawRegimeToString(raw).toLowerCase();
  if (s === "por_ciclo") return "por_ciclo";
  if (s === "por_miligrama") return "por_miligrama";
  if (s === "diario") return "diario";
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
  consumo_mg_diario?: number | null;
  medicamento_concentracao?: string;
}

export function taxaFromPersistRow(row: PacienteMedicamentoPersistRow): number {
  const regime = parseRegimeConsumo(row.regime_consumo);
  if (regime === "por_miligrama") {
    const mg = Number(row.consumo_mg_diario);
    const conc = String(row.medicamento_concentracao ?? "");
    const mgPorUnidade = parseMgPorUnidadeFromConcentracao(conc);
    if (!Number.isFinite(mg) || mg <= 0 || mgPorUnidade == null) return 0;
    return mg / mgPorUnidade;
  }
  return taxaUnidadesPorDia(regime, Number(row.consumo_diario), row.unidades_por_ciclo, row.intervalo_ciclo_dias);
}

/**
 * Se todos os vínculos do grupo forem `por_ciclo` com o **mesmo** intervalo (dias),
 * retorna a soma das unidades por ciclo e esse intervalo — exibe "Por ciclo: N unid. a cada D dias"
 * com N = soma das unidades (vários pacientes ou doses diferentes no mesmo intervalo).
 * Intervalos diferentes no mesmo medicamento → null (UI agrega só em unid./dia).
 */
export function tryResumoPorCicloHomogeneo(
  linhas: PacienteMedicamentoPersistRow[]
): { unidadesTotal: number; intervaloDias: number } | null {
  if (linhas.length === 0) return null;
  let dRef: number | null = null;
  for (const r of linhas) {
    if (parseRegimeConsumo(r.regime_consumo) !== "por_ciclo") return null;
    const u = Number(r.unidades_por_ciclo);
    const d = Number(r.intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return null;
    if (dRef === null) dRef = d;
    else if (dRef !== d) return null;
  }
  if (dRef === null) return null;
  const unidadesTotal = linhas.reduce((s, r) => s + Number(r.unidades_por_ciclo), 0);
  return { unidadesTotal, intervaloDias: dRef };
}

export type ResumoTaxaMeta =
  | {
      resumoTaxaTipo: "por_ciclo_homogeneo";
      porCicloUnidadesTotal: number;
      porCicloIntervaloDias: number;
    }
  | { resumoTaxaTipo: "diario_apenas" }
  | { resumoTaxaTipo: "agregado" };

/** Classifica o grupo de vínculos para a UI do resumo por medicamento. */
export function buildResumoTaxaMeta(linhas: PacienteMedicamentoPersistRow[]): ResumoTaxaMeta {
  const homo = tryResumoPorCicloHomogeneo(linhas);
  if (homo) {
    return {
      resumoTaxaTipo: "por_ciclo_homogeneo",
      porCicloUnidadesTotal: homo.unidadesTotal,
      porCicloIntervaloDias: homo.intervaloDias,
    };
  }
  if (linhas.length > 0 && linhas.every((r) => parseRegimeConsumo(r.regime_consumo) === "diario")) {
    return { resumoTaxaTipo: "diario_apenas" };
  }
  return { resumoTaxaTipo: "agregado" };
}
