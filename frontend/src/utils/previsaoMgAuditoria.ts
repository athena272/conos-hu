import type { PacienteMedicamento, PrevisaoMg } from "../types/paciente";
import {
  formatarMgPtBr,
  formatarNumeroTaxaPtBr,
  getNotaPrevisaoMgIndisponivel,
  intervaloMgDias,
  normalizeRegimeConsumo,
  parseMgPorUnidadeFromConcentracao,
  previsaoMgTemValor,
  resolvePrevisaoMgMedicamento,
} from "./pacienteMedicamentoDisplay";

const DIAS_POR_MES = 30;

const REGIME_LABELS: Record<
  ReturnType<typeof normalizeRegimeConsumo>,
  string
> = {
  diario: "Consumo diário",
  por_ciclo: "Por ciclo",
  por_miligrama: "Consumo por miligrama",
};

export type PrevisaoMgAuditoriaPasso = {
  rotulo: string;
  detalhe: string;
};

export type AuditoriaTrilha = {
  titulo: string;
  intro: string;
  passos: PrevisaoMgAuditoriaPasso[];
  indisponivel?: string | null;
};

export type PrevisaoMgAuditoria = {
  medicamentoLabel: string;
  regimeLabel: string;
  passos: PrevisaoMgAuditoriaPasso[];
  previsao: PrevisaoMg;
  indisponivel: string | null;
};

export type BuildPrevisaoMgAuditoriaOpts = {
  /** Previsão exibida na célula (já resolvida). */
  previsaoExibida?: PrevisaoMg | null;
};

function passosResultado(previsao: PrevisaoMg): PrevisaoMgAuditoriaPasso[] {
  const passos: PrevisaoMgAuditoriaPasso[] = [];
  if (!previsaoMgTemValor(previsao)) return passos;

  const mgDia = previsao.mg_dia_previsto!;
  passos.push({
    rotulo: "Mg/dia (A)",
    detalhe: `${formatarMgPtBr(mgDia)}/dia`,
  });

  if (previsao.mg_mes_previsto != null) {
    passos.push({
      rotulo: "Mg/mês (B)",
      detalhe: `${formatarMgPtBr(mgDia)}/dia × ${DIAS_POR_MES} dias = ${formatarMgPtBr(previsao.mg_mes_previsto)}/mês`,
    });
  }

  if (previsao.mg_contextual != null) {
    const rotuloCtx =
      previsao.contextual_rotulo === "mg/ciclo" ? "Mg/ciclo (C)" : "Contextual (C)";
    passos.push({
      rotulo: rotuloCtx,
      detalhe: `${formatarMgPtBr(previsao.mg_contextual)}/${previsao.contextual_rotulo.replace("mg/", "")}`,
    });
  }

  return passos;
}

/**
 * Monta trilha de auditoria explicando como a previsão em mg foi obtida
 * a partir do vínculo paciente–medicamento.
 */
export function buildPrevisaoMgAuditoria(
  m: PacienteMedicamento,
  opts: BuildPrevisaoMgAuditoriaOpts = {},
): PrevisaoMgAuditoria {
  const regime = normalizeRegimeConsumo(m);
  const nome = String(m.medicamento_nome ?? "").trim();
  const conc = String(m.medicamento_concentracao ?? "").trim();
  const medicamentoLabel = `${nome} ${conc}`.trim();

  const previsaoExibida =
    opts.previsaoExibida ??
    resolvePrevisaoMgMedicamento(m);

  const passos: PrevisaoMgAuditoriaPasso[] = [
    {
      rotulo: "Medicamento",
      detalhe: `${nome} — concentração cadastrada: "${conc}"`,
    },
    {
      rotulo: "Regime de consumo",
      detalhe: REGIME_LABELS[regime],
    },
    {
      rotulo: "Origem dos dados",
      detalhe:
        "Cadastro do vínculo paciente–medicamento. Não utiliza retiradas, dispensação ou histórico.",
    },
  ];

  if (regime === "por_miligrama") {
    const mg = Number(m.consumo_mg_diario);
    const dias = intervaloMgDias(m);
    const mgValido = Number.isFinite(mg) && mg > 0;
    passos.push({
      rotulo: "Consumo informado",
      detalhe: mgValido
        ? dias > 1
          ? `${formatarNumeroTaxaPtBr(mg)} mg a cada ${dias} dias (campo consumo em mg)`
          : `${formatarNumeroTaxaPtBr(mg)} mg/dia (campo consumo em mg)`
        : "Campo consumo em mg não informado ou inválido.",
    });
    if (mgValido && dias > 1) {
      passos.push({
        rotulo: "Cálculo mg/dia (A)",
        detalhe: `${formatarNumeroTaxaPtBr(mg)} mg ÷ ${dias} dias = ${formatarMgPtBr(mg / dias)}/dia`,
      });
    }
    passos.push({
      rotulo: "Regra",
      detalhe:
        "No regime por miligrama, mg/dia = mg informados ÷ intervalo (dias), sem multiplicar pela concentração.",
    });
  } else {
    const mgPorUnidade = parseMgPorUnidadeFromConcentracao(conc);
    if (mgPorUnidade == null) {
      passos.push({
        rotulo: "Concentração",
        detalhe: `Não foi possível extrair mg por unidade de "${conc}".`,
      });
    } else {
      passos.push({
        rotulo: "Mg por unidade",
        detalhe: `Extraído de "${conc}": ${formatarMgPtBr(mgPorUnidade)}/unid.`,
      });
    }

    if (regime === "diario") {
      const c = Number(m.consumo_diario);
      passos.push({
        rotulo: "Consumo diário",
        detalhe: Number.isFinite(c) && c > 0
          ? `${formatarNumeroTaxaPtBr(c)} unid./dia`
          : "Consumo diário não informado ou zero.",
      });
      if (mgPorUnidade != null && Number.isFinite(c) && c > 0) {
        const mgDia = c * mgPorUnidade;
        passos.push({
          rotulo: "Cálculo mg/dia (A)",
          detalhe: `${formatarNumeroTaxaPtBr(c)} unid./dia × ${formatarMgPtBr(mgPorUnidade)}/unid. = ${formatarMgPtBr(mgDia)}/dia`,
        });
      }
    } else {
      const u = Number(m.unidades_por_ciclo);
      const d = Number(m.intervalo_ciclo_dias);
      passos.push({
        rotulo: "Ciclo",
        detalhe:
          Number.isFinite(u) && u > 0 && Number.isInteger(d) && d >= 1
            ? `${formatarNumeroTaxaPtBr(u)} unid. a cada ${d} dias`
            : "Unidades por ciclo ou intervalo inválidos.",
      });
      if (mgPorUnidade != null && Number.isFinite(u) && u > 0 && Number.isInteger(d) && d >= 1) {
        const mgCiclo = u * mgPorUnidade;
        const mgDia = mgCiclo / d;
        passos.push({
          rotulo: "Cálculo mg/ciclo (C)",
          detalhe: `${formatarNumeroTaxaPtBr(u)} unid. × ${formatarMgPtBr(mgPorUnidade)}/unid. = ${formatarMgPtBr(mgCiclo)}/ciclo`,
        });
        passos.push({
          rotulo: "Cálculo mg/dia (A)",
          detalhe: `${formatarMgPtBr(mgCiclo)}/ciclo ÷ ${d} dias = ${formatarMgPtBr(mgDia)}/dia`,
        });
      }
    }
  }

  passos.push(...passosResultado(previsaoExibida));

  const indisponivel = previsaoMgTemValor(previsaoExibida)
    ? null
    : getNotaPrevisaoMgIndisponivel({ ...m, previsao_mg: previsaoExibida });

  return {
    medicamentoLabel,
    regimeLabel: REGIME_LABELS[regime],
    passos,
    previsao: previsaoExibida,
    indisponivel,
  };
}

/** Converte auditoria de vínculo para o formato do diálogo. */
export function previsaoMgAuditoriaParaTrilha(a: PrevisaoMgAuditoria): AuditoriaTrilha {
  return {
    titulo: `Previsão: ${a.medicamentoLabel}`,
    intro: `Trilha de cálculo com base no vínculo paciente–medicamento. Regime: ${a.regimeLabel}.`,
    passos: a.passos,
    indisponivel: a.indisponivel,
  };
}

/** Garante que a auditoria descreve a mesma previsão exibida na célula. */
export function auditoriaCoerenteComPrevisao(
  auditoria: PrevisaoMgAuditoria,
  previsaoExibida: PrevisaoMg | null | undefined,
): boolean {
  const a = auditoria.previsao?.mg_dia_previsto ?? null;
  const b = previsaoExibida?.mg_dia_previsto ?? null;
  return a === b;
}
