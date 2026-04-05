import type {
  Paciente,
  PacienteMedicamento,
  ResumoTaxaTipo,
} from "../types/paciente";

export function normalizeRegimeConsumo(
  m: Pick<PacienteMedicamento, "regime_consumo">,
): "diario" | "por_ciclo" {
  const raw = m.regime_consumo;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "por_ciclo" ? "por_ciclo" : "diario";
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

/** Números de taxa para exibição (pt-BR, até 4 casas, sem artefatos de float na UI). */
export function formatarNumeroTaxaPtBr(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

export type CamposRegimeVinculo = Pick<
  PacienteMedicamento,
  "regime_consumo" | "consumo_diario" | "unidades_por_ciclo" | "intervalo_ciclo_dias"
>;

/**
 * Linhas para a coluna "Taxa" na lista de pacientes (regime explícito).
 */
export function getLinhasTaxaVinculo(
  m: CamposRegimeVinculo,
): { principal: string; secundaria?: string } {
  if (normalizeRegimeConsumo(m) === "por_ciclo") {
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
      a.prontuario - b.prontuario,
  );
  return out;
}
