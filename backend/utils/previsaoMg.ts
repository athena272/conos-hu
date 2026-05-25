import {
  parseMgPorUnidadeFromConcentracao,
  mgTotaisFromUnidades,
} from "./concentracaoMg";
import {
  parseRegimeConsumo,
  tryResumoPorCicloHomogeneo,
  type PacienteMedicamentoPersistRow,
} from "./pacienteMedicamentoRegime";

export type ContextualRotulo = "mg/dia" | "mg/ciclo";

export interface PrevisaoMg {
  mg_dia_previsto: number | null;
  mg_mes_previsto: number | null;
  mg_contextual: number | null;
  contextual_rotulo: ContextualRotulo;
}

export interface PrevisaoMgRow extends PacienteMedicamentoPersistRow {
  medicamento_concentracao: string;
  consumo_mg_diario?: number | null;
}

const DIAS_POR_MES = 30;

function nullPrevisao(): PrevisaoMg {
  return {
    mg_dia_previsto: null,
    mg_mes_previsto: null,
    mg_contextual: null,
    contextual_rotulo: "mg/dia",
  };
}

function finalizePrevisao(mgDia: number | null, contextual: number | null, rotulo: ContextualRotulo): PrevisaoMg {
  if (mgDia == null || !Number.isFinite(mgDia) || mgDia <= 0) {
    return nullPrevisao();
  }
  return {
    mg_dia_previsto: mgDia,
    mg_mes_previsto: mgDia * DIAS_POR_MES,
    mg_contextual: contextual,
    contextual_rotulo: rotulo,
  };
}

/** Taxa em mg/dia a partir do vínculo paciente–medicamento. */
export function taxaMgPorDiaFromRow(row: PrevisaoMgRow): number | null {
  const regime = parseRegimeConsumo(row.regime_consumo);
  const conc = String(row.medicamento_concentracao ?? "");

  if (regime === "por_miligrama") {
    const mg = Number(row.consumo_mg_diario);
    return Number.isFinite(mg) && mg > 0 ? mg : null;
  }

  const mgPorUnidade = parseMgPorUnidadeFromConcentracao(conc);
  if (mgPorUnidade == null) return null;

  if (regime === "por_ciclo") {
    const u = Number(row.unidades_por_ciclo);
    const d = Number(row.intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return null;
    return (u * mgPorUnidade) / d;
  }

  const c = Number(row.consumo_diario);
  if (!Number.isFinite(c) || c <= 0) return null;
  return c * mgPorUnidade;
}

/** Previsão A, B e C para um vínculo paciente–medicamento. */
export function buildPrevisaoMgFromRow(row: PrevisaoMgRow): PrevisaoMg {
  const regime = parseRegimeConsumo(row.regime_consumo);
  const conc = String(row.medicamento_concentracao ?? "");
  const mgDia = taxaMgPorDiaFromRow(row);

  if (regime === "por_ciclo") {
    const mgCiclo = mgTotaisFromUnidades(Number(row.unidades_por_ciclo), conc);
    return finalizePrevisao(mgDia, mgCiclo, "mg/ciclo");
  }

  return finalizePrevisao(mgDia, mgDia, "mg/dia");
}

/** Agrega previsões de vários vínculos do mesmo medicamento (nome+concentração). */
export function agregarPrevisaoMg(linhas: PrevisaoMgRow[]): PrevisaoMg {
  if (linhas.length === 0) return nullPrevisao();

  const conc = String(linhas[0]?.medicamento_concentracao ?? "");
  let mgDiaTotal = 0;
  let hasMgDia = false;

  for (const row of linhas) {
    const mgDia = taxaMgPorDiaFromRow(row);
    if (mgDia != null) {
      mgDiaTotal += mgDia;
      hasMgDia = true;
    }
  }

  if (!hasMgDia) return nullPrevisao();

  const homo = tryResumoPorCicloHomogeneo(linhas);
  if (homo) {
    const mgCicloTotal = mgTotaisFromUnidades(homo.unidadesTotal, conc);
    return finalizePrevisao(mgDiaTotal, mgCicloTotal, "mg/ciclo");
  }

  return finalizePrevisao(mgDiaTotal, mgDiaTotal, "mg/dia");
}

/** Meses de estoque com base em mg/dia total e estoque em unidades. */
export function mesesEstoqueFromMg(
  estoqueUnidades: number,
  mgDiaTotal: number | null,
  concentracao: string
): number | null {
  const mgPorUnidade = parseMgPorUnidadeFromConcentracao(concentracao);
  if (mgPorUnidade == null) {
    return estoqueUnidades > 0 ? null : 0;
  }
  if (mgDiaTotal == null || mgDiaTotal <= 0) {
    return estoqueUnidades > 0 ? null : 0;
  }
  const estoqueMg = estoqueUnidades * mgPorUnidade;
  if (estoqueMg <= 0) return 0;
  return Math.floor(estoqueMg / (mgDiaTotal * DIAS_POR_MES));
}
