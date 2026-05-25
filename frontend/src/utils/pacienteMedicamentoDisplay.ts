import type {
  Paciente,
  PacienteMedicamento,
  PrevisaoMg,
  RegimeConsumoMedicamento,
  ResumoTaxaTipo,
} from "../types/paciente";

export function normalizeRegimeConsumo(
  m: Pick<PacienteMedicamento, "regime_consumo">,
): RegimeConsumoMedicamento {
  const raw = m.regime_consumo;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "por_ciclo") return "por_ciclo";
  if (s === "por_miligrama") return "por_miligrama";
  return "diario";
}

const DIAS_POR_MES = 30;

export function parseMgPorUnidadeFromConcentracao(concentracao: string): number | null {
  const s = String(concentracao ?? "").trim();
  if (!s) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*mg\b/i.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mgTotaisFromUnidades(quantidadeUnidades: number, concentracao: string): number | null {
  const mg = parseMgPorUnidadeFromConcentracao(concentracao);
  if (mg == null) return null;
  const q = Number(quantidadeUnidades);
  if (!Number.isFinite(q) || q <= 0) return null;
  return q * mg;
}

function nullPrevisaoMg(): PrevisaoMg {
  return {
    mg_dia_previsto: null,
    mg_mes_previsto: null,
    mg_contextual: null,
    contextual_rotulo: "mg/dia",
  };
}

function finalizePrevisaoMg(
  mgDia: number | null,
  contextual: number | null,
  rotulo: PrevisaoMg["contextual_rotulo"],
): PrevisaoMg {
  if (mgDia == null || !Number.isFinite(mgDia) || mgDia <= 0) {
    return nullPrevisaoMg();
  }
  return {
    mg_dia_previsto: mgDia,
    mg_mes_previsto: mgDia * DIAS_POR_MES,
    mg_contextual: contextual,
    contextual_rotulo: rotulo,
  };
}

/** Taxa em mg/dia (mesma regra do backend). */
export function taxaMgPorDiaFromMedicamento(m: PacienteMedicamento): number | null {
  const regime = normalizeRegimeConsumo(m);
  const conc = String(m.medicamento_concentracao ?? "");

  if (regime === "por_miligrama") {
    const mg = Number(m.consumo_mg_diario);
    return Number.isFinite(mg) && mg > 0 ? mg : null;
  }

  const mgPorUnidade = parseMgPorUnidadeFromConcentracao(conc);
  if (mgPorUnidade == null) return null;

  if (regime === "por_ciclo") {
    const u = Number(m.unidades_por_ciclo);
    const d = Number(m.intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return null;
    return (u * mgPorUnidade) / d;
  }

  const c = Number(m.consumo_diario);
  if (!Number.isFinite(c) || c <= 0) return null;
  return c * mgPorUnidade;
}

/** Previsão A/B/C a partir do vínculo (fallback quando a API não envia `previsao_mg`). */
export function buildPrevisaoMgFromMedicamento(m: PacienteMedicamento): PrevisaoMg {
  const regime = normalizeRegimeConsumo(m);
  const conc = String(m.medicamento_concentracao ?? "");
  const mgDia = taxaMgPorDiaFromMedicamento(m);

  if (regime === "por_ciclo") {
    const mgCiclo = mgTotaisFromUnidades(Number(m.unidades_por_ciclo), conc);
    return finalizePrevisaoMg(mgDia, mgCiclo, "mg/ciclo");
  }

  return finalizePrevisaoMg(mgDia, mgDia, "mg/dia");
}

export function previsaoMgTemValor(p: PrevisaoMg | null | undefined): boolean {
  return p != null && p.mg_dia_previsto != null && p.mg_dia_previsto > 0;
}

/** Usa previsão da API ou calcula localmente a partir do vínculo. */
export function resolvePrevisaoMgMedicamento(m: PacienteMedicamento): PrevisaoMg {
  if (previsaoMgTemValor(m.previsao_mg)) {
    return m.previsao_mg!;
  }
  return buildPrevisaoMgFromMedicamento(m);
}

/** Agrega previsões de vários vínculos do mesmo medicamento. */
export function agregarPrevisaoMgMedicamentos(linhas: PacienteMedicamento[]): PrevisaoMg {
  if (linhas.length === 0) return nullPrevisaoMg();

  const conc = String(linhas[0]?.medicamento_concentracao ?? "");
  let mgDiaTotal = 0;
  let hasMgDia = false;

  for (const m of linhas) {
    const mgDia = taxaMgPorDiaFromMedicamento(m);
    if (mgDia != null) {
      mgDiaTotal += mgDia;
      hasMgDia = true;
    }
  }

  if (!hasMgDia) return nullPrevisaoMg();

  const homo = tryResumoPorCicloHomogeneoFromMedicamentos(linhas);
  if (homo) {
    const mgCicloTotal = mgTotaisFromUnidades(homo.unidadesTotal, conc);
    return finalizePrevisaoMg(mgDiaTotal, mgCicloTotal, "mg/ciclo");
  }

  return finalizePrevisaoMg(mgDiaTotal, mgDiaTotal, "mg/dia");
}

export function mesesEstoqueFromMgFrontend(
  estoqueUnidades: number,
  mgDiaTotal: number | null,
  concentracao: string,
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

export function normalizePrevisaoMgFromApi(raw: unknown): PrevisaoMg | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const mgDiaRaw = r.mg_dia_previsto ?? r.mgDiaPrevisto;
  const mgMesRaw = r.mg_mes_previsto ?? r.mgMesPrevisto;
  const mgCtxRaw = r.mg_contextual ?? r.mgContextual;
  const rotuloRaw = r.contextual_rotulo ?? r.contextualRotulo;
  if (mgDiaRaw === undefined && mgMesRaw === undefined && mgCtxRaw === undefined) {
    return undefined;
  }
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    mg_dia_previsto: toNum(mgDiaRaw),
    mg_mes_previsto: toNum(mgMesRaw),
    mg_contextual: toNum(mgCtxRaw),
    contextual_rotulo: rotuloRaw === "mg/ciclo" ? "mg/ciclo" : "mg/dia",
  };
}

export function normalizePacienteLista(data: unknown): Paciente[] {
  if (!Array.isArray(data)) return [];
  return (data as Paciente[]).map((p) => ({
    ...p,
    medicamentos: (p.medicamentos ?? []).map((m) => {
      const fromApi = normalizePrevisaoMgFromApi(m.previsao_mg);
      const merged = { ...m, ...(fromApi ? { previsao_mg: fromApi } : {}) };
      return {
        ...merged,
        previsao_mg: resolvePrevisaoMgMedicamento(merged),
      };
    }),
  }));
}

/** Nota secundária quando não há previsão em mg. */
export function getNotaPrevisaoMgIndisponivel(m: PacienteMedicamento): string | null {
  if (previsaoMgTemValor(m.previsao_mg)) return null;
  if (normalizeRegimeConsumo(m) === "por_miligrama") {
    return "Informe consumo em mg/dia no cadastro";
  }
  return "Concentração sem mg no cadastro";
}

export function taxaUnidadesPorDiaFromMedicamento(m: PacienteMedicamento): number {
  const regime = normalizeRegimeConsumo(m);
  if (regime === "por_ciclo") {
    const u = Number(m.unidades_por_ciclo);
    const d = Number(m.intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return 0;
    return u / d;
  }
  if (regime === "por_miligrama") {
    const mg = Number(m.consumo_mg_diario);
    const mgPorUnidade = parseMgPorUnidadeFromConcentracao(m.medicamento_concentracao ?? "");
    if (!Number.isFinite(mg) || mg <= 0 || mgPorUnidade == null) return 0;
    return mg / mgPorUnidade;
  }
  const c = Number(m.consumo_diario);
  return Number.isFinite(c) && c > 0 ? c : 0;
}

/** Texto curto para listagens (ex.: "2/dia" ou "1 unid. / 45 dias"). */
export function usoMedicamentoResumo(m: PacienteMedicamento): string {
  const regime = normalizeRegimeConsumo(m);
  if (regime === "por_ciclo") {
    const u = m.unidades_por_ciclo;
    const d = m.intervalo_ciclo_dias;
    if (u != null && d != null) return `${u} unid. / ${d} dias`;
    return "por ciclo";
  }
  if (regime === "por_miligrama") {
    const mg = m.consumo_mg_diario;
    return mg != null ? `${mg} mg/dia` : "por miligrama";
  }
  return `${m.consumo_diario}/dia`;
}

/** Números de taxa para exibição (pt-BR, até 4 casas, sem artefatos de float na UI). */
export function formatarNumeroTaxaPtBr(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

/** Formata valor em mg para exibição. */
export function formatarMgPtBr(mg: number | null | undefined): string {
  if (mg === null || mg === undefined) return "—";
  if (!Number.isFinite(mg)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(mg)} mg`;
}

/** @deprecated use formatarMgPtBr */
export const formatarMgAcumuladoPtBr = formatarMgPtBr;

export type LinhaPrevisaoMg = {
  principal: boolean;
  texto: string;
};

/** Três linhas de previsão (A mg/dia, B mg/mês, C contextual) para UI. */
export function formatarPrevisaoMgLinhas(previsao: PrevisaoMg | null | undefined): LinhaPrevisaoMg[] {
  if (!previsao || previsao.mg_dia_previsto == null) {
    return [{ principal: true, texto: "—" }];
  }
  const linhas: LinhaPrevisaoMg[] = [
    { principal: true, texto: `${formatarMgPtBr(previsao.mg_dia_previsto)}/dia` },
  ];
  if (previsao.mg_mes_previsto != null) {
    linhas.push({
      principal: false,
      texto: `${formatarMgPtBr(previsao.mg_mes_previsto)}/mês (30 dias)`,
    });
  }
  if (previsao.mg_contextual != null) {
    linhas.push({
      principal: false,
      texto: `${formatarMgPtBr(previsao.mg_contextual)}/${previsao.contextual_rotulo.replace("mg/", "")}`,
    });
  }
  return linhas;
}

export type CamposRegimeVinculo = Pick<
  PacienteMedicamento,
  | "regime_consumo"
  | "consumo_diario"
  | "unidades_por_ciclo"
  | "intervalo_ciclo_dias"
  | "consumo_mg_diario"
  | "medicamento_concentracao"
>;

/**
 * Linhas para a coluna "Taxa" na lista de pacientes (regime explícito).
 */
export function getLinhasTaxaVinculo(
  m: CamposRegimeVinculo,
): { principal: string; secundaria?: string } {
  const regime = normalizeRegimeConsumo(m);
  if (regime === "por_ciclo") {
    const u = m.unidades_por_ciclo;
    const d = m.intervalo_ciclo_dias;
    const taxa = taxaUnidadesPorDiaFromMedicamento(m as PacienteMedicamento);
    if (u != null && d != null) {
      return {
        principal: `Por ciclo: ${u} unid. a cada ${d} dias`,
        secundaria: `Equiv. ≈ ${formatarNumeroTaxaPtBr(taxa)} unid./dia`,
      };
    }
    return {
      principal: "Por ciclo",
      secundaria:
        taxa > 0
          ? `Equiv. ≈ ${formatarNumeroTaxaPtBr(taxa)} unid./dia`
          : undefined,
    };
  }
  if (regime === "por_miligrama") {
    const mg = Number(m.consumo_mg_diario);
    return {
      principal: `Consumo por miligrama: ${formatarNumeroTaxaPtBr(Number.isFinite(mg) ? mg : 0)} mg/dia`,
    };
  }
  const c = Number(m.consumo_diario);
  return {
    principal: `Consumo diário: ${formatarNumeroTaxaPtBr(Number.isFinite(c) ? c : 0)} unid./dia`,
  };
}

/** Célula da tabela "Estoque por medicamento" (valor agregado). */
export function getTextoResumoTaxaAgregada(total: number): {
  principal: string;
  secundaria: string;
} {
  const t = Number.isFinite(total) ? total : 0;
  return {
    principal: `${formatarNumeroTaxaPtBr(t)} unid./dia`,
    secundaria: "Soma das taxas equivalentes (diário e por ciclo)",
  };
}

function tryResumoPorCicloHomogeneoFromMedicamentos(
  linhas: PacienteMedicamento[],
): { unidadesTotal: number; intervaloDias: number } | null {
  if (linhas.length === 0) return null;
  let dRef: number | null = null;
  for (const m of linhas) {
    if (normalizeRegimeConsumo(m) !== "por_ciclo") return null;
    const u = Number(m.unidades_por_ciclo);
    const d = Number(m.intervalo_ciclo_dias);
    if (!Number.isFinite(u) || u <= 0 || !Number.isInteger(d) || d < 1) return null;
    if (dRef === null) dRef = d;
    else if (dRef !== d) return null;
  }
  if (dRef === null) return null;
  const unidadesTotal = linhas.reduce((s, m) => s + Number(m.unidades_por_ciclo), 0);
  return { unidadesTotal, intervaloDias: dRef };
}

/**
 * Classifica vínculos do mesmo medicamento (mesmo critério do resumo no backend).
 * Usado quando a API não envia `resumoTaxaTipo` (deploy antigo).
 */
export function inferResumoTaxaMetaFromMedicamentos(linhas: PacienteMedicamento[]): {
  resumoTaxaTipo: ResumoTaxaTipo;
  porCicloUnidadesTotal?: number;
  porCicloIntervaloDias?: number;
} | null {
  if (linhas.length === 0) return null;
  const homo = tryResumoPorCicloHomogeneoFromMedicamentos(linhas);
  if (homo) {
    return {
      resumoTaxaTipo: "por_ciclo_homogeneo",
      porCicloUnidadesTotal: homo.unidadesTotal,
      porCicloIntervaloDias: homo.intervaloDias,
    };
  }
  if (linhas.every((m) => normalizeRegimeConsumo(m) === "diario")) {
    return { resumoTaxaTipo: "diario_apenas" };
  }
  return { resumoTaxaTipo: "agregado" };
}

export type ItemDetalheTaxaResumo = {
  pacienteId: number;
  pacienteNome: string;
  prontuario: number;
  equivUnidDia: number;
  linhasRegime: string[];
};

/**
 * Pacientes que usam o mesmo nome+concentração, com texto de regime e taxa equivalente diária (para soma agregada).
 */
export function itensDetalheTaxaAgregada(
  medicamentoNome: string,
  medicamentoConcentracao: string,
  pacientes: Paciente[],
): ItemDetalheTaxaResumo[] {
  const out: ItemDetalheTaxaResumo[] = [];
  for (const p of pacientes) {
    const meds = (p.medicamentos ?? []).filter(
      (m) =>
        m.medicamento_nome === medicamentoNome &&
        m.medicamento_concentracao === medicamentoConcentracao,
    );
    for (const m of meds) {
      const equiv = taxaUnidadesPorDiaFromMedicamento(m);
      if (!(equiv > 0)) continue;
      const { principal, secundaria } = getLinhasTaxaVinculo(m);
      const linhasRegime = secundaria ? [principal, secundaria] : [principal];
      out.push({
        pacienteId: p.id,
        pacienteNome: p.nome,
        prontuario: p.prontuario,
        equivUnidDia: equiv,
        linhasRegime,
      });
    }
  }
  out.sort(
    (a, b) =>
      a.pacienteNome.localeCompare(b.pacienteNome, "pt-BR") ||
      a.prontuario - b.prontuario ||
      a.pacienteId - b.pacienteId,
  );
  return out;
}
