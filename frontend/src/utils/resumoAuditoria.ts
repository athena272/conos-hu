import type { Paciente, PacienteMedicamento, PrevisaoMg, ResumoPorMedicamento } from "../types/paciente";
import {
  agregarPrevisaoMgMedicamentos,
  formatarMgPtBr,
  formatarNumeroTaxaPtBr,
  getLinhasTaxaVinculo,
  inferResumoTaxaMetaFromMedicamentos,
  parseMgPorUnidadeFromConcentracao,
  previsaoMgTemValor,
  taxaMgPorDiaFromMedicamento,
  taxaUnidadesPorDiaFromMedicamento,
} from "./pacienteMedicamentoDisplay";
import type { AuditoriaTrilha, PrevisaoMgAuditoriaPasso } from "./previsaoMgAuditoria";

const DIAS_POR_MES = 30;

function normalizeDiasPeriodo(diasPeriodo: number | undefined): number {
  return diasPeriodo != null && Number.isFinite(diasPeriodo) && diasPeriodo > 0
    ? diasPeriodo
    : DIAS_POR_MES;
}

/** Rótulo da unidade de duração do estoque conforme o período simulado. */
function rotuloPeriodo(periodo: number): string {
  return periodo === DIAS_POR_MES ? "meses" : `períodos de ${periodo} dias`;
}

export type ContribuicaoPacienteResumo = {
  pacienteNome: string;
  prontuario: number;
  mgDia: number | null;
  unidDia: number;
  regimeTexto: string;
};

export function vinculosResumoComPaciente(
  medicamentoNome: string,
  medicamentoConcentracao: string,
  pacientes: Paciente[],
): Array<{ paciente: Paciente; medicamento: PacienteMedicamento }> {
  const out: Array<{ paciente: Paciente; medicamento: PacienteMedicamento }> = [];
  for (const p of pacientes) {
    for (const m of p.medicamentos ?? []) {
      if (
        m.medicamento_nome === medicamentoNome &&
        m.medicamento_concentracao === medicamentoConcentracao
      ) {
        out.push({ paciente: p, medicamento: m });
      }
    }
  }
  out.sort(
    (a, b) =>
      a.paciente.nome.localeCompare(b.paciente.nome, "pt-BR") ||
      a.paciente.prontuario - b.paciente.prontuario,
  );
  return out;
}

export function contribuicoesResumoPorPaciente(
  medicamentoNome: string,
  medicamentoConcentracao: string,
  pacientes: Paciente[],
): ContribuicaoPacienteResumo[] {
  return vinculosResumoComPaciente(medicamentoNome, medicamentoConcentracao, pacientes).map(
    ({ paciente, medicamento }) => {
      const { principal } = getLinhasTaxaVinculo(medicamento);
      return {
        pacienteNome: paciente.nome,
        prontuario: paciente.prontuario,
        mgDia: taxaMgPorDiaFromMedicamento(medicamento),
        unidDia: taxaUnidadesPorDiaFromMedicamento(medicamento),
        regimeTexto: principal,
      };
    },
  );
}

export type BuildResumoAuditoriaInput = {
  row: ResumoPorMedicamento;
  pacientes: Paciente[];
  previsaoExibida?: PrevisaoMg | null;
  mesesUnidExibido?: number | null;
  mesesMgExibido?: number | null;
  /** Período simulado em dias (default 30 = comportamento canônico). */
  diasPeriodo?: number;
};

function passosResultadoAgregado(
  previsao: PrevisaoMg,
  periodo: number,
): PrevisaoMgAuditoriaPasso[] {
  if (!previsaoMgTemValor(previsao)) return [];
  const mgDia = previsao.mg_dia_previsto!;
  const passos: PrevisaoMgAuditoriaPasso[] = [
    { rotulo: "Total mg/dia (A)", detalhe: `${formatarMgPtBr(mgDia)}/dia` },
  ];
  if (periodo === DIAS_POR_MES) {
    if (previsao.mg_mes_previsto != null) {
      passos.push({
        rotulo: "Total mg/mês (B)",
        detalhe: `${formatarMgPtBr(mgDia)}/dia × ${DIAS_POR_MES} dias = ${formatarMgPtBr(previsao.mg_mes_previsto)}/mês`,
      });
    }
  } else {
    passos.push({
      rotulo: `Total mg em ${periodo} dias (B)`,
      detalhe: `${formatarMgPtBr(mgDia)}/dia × ${periodo} dias = ${formatarMgPtBr(mgDia * periodo)}`,
    });
  }
  if (previsao.mg_contextual != null) {
    const rotuloCtx =
      previsao.contextual_rotulo === "mg/ciclo" ? "Total mg/ciclo (C)" : "Contextual (C)";
    passos.push({
      rotulo: rotuloCtx,
      detalhe: `${formatarMgPtBr(previsao.mg_contextual)}/${previsao.contextual_rotulo.replace("mg/", "")}`,
    });
  }
  return passos;
}

export function buildPrevisaoMgResumoAuditoria(input: BuildResumoAuditoriaInput): AuditoriaTrilha {
  const { row, pacientes } = input;
  const periodo = normalizeDiasPeriodo(input.diasPeriodo);
  const label = `${row.medicamento_nome} ${row.medicamento_concentracao}`.trim();
  const vinculos = vinculosResumoComPaciente(
    row.medicamento_nome,
    row.medicamento_concentracao,
    pacientes,
  );
  const contrib = contribuicoesResumoPorPaciente(
    row.medicamento_nome,
    row.medicamento_concentracao,
    pacientes,
  );

  const linhasMedicamentos = vinculos.map((v) => v.medicamento);
  const previsao =
    input.previsaoExibida ??
    (linhasMedicamentos.length > 0
      ? agregarPrevisaoMgMedicamentos(linhasMedicamentos)
      : row.previsaoMgTotal ?? agregarPrevisaoMgMedicamentos([]));

  const taxaMeta = inferResumoTaxaMetaFromMedicamentos(linhasMedicamentos);

  const passos: PrevisaoMgAuditoriaPasso[] = [
    {
      rotulo: "Medicamento",
      detalhe: `${row.medicamento_nome} — concentração "${row.medicamento_concentracao}"`,
    },
    {
      rotulo: "Pacientes vinculados",
      detalhe: `${row.qtdPacientes} paciente(s) com este medicamento no cadastro`,
    },
    {
      rotulo: "Origem dos dados",
      detalhe:
        "Soma das previsões de consumo de cada paciente vinculado. Não utiliza retiradas, dispensação ou histórico.",
    },
  ];

  if (taxaMeta?.resumoTaxaTipo === "por_ciclo_homogeneo") {
    passos.push({
      rotulo: "Tipo de agregação",
      detalhe: `Por ciclo homogêneo: ${taxaMeta.porCicloUnidadesTotal} unid. a cada ${taxaMeta.porCicloIntervaloDias} dias (soma dos pacientes)`,
    });
  } else if (taxaMeta?.resumoTaxaTipo === "diario_apenas") {
    passos.push({
      rotulo: "Tipo de agregação",
      detalhe: "Todos os pacientes usam consumo diário — soma simples de mg/dia.",
    });
  } else if (contrib.length > 0) {
    passos.push({
      rotulo: "Tipo de agregação",
      detalhe: "Regimes mistos — cada paciente contribui com sua taxa em mg/dia e o total é a soma.",
    });
  }

  for (const c of contrib) {
    const mgTexto =
      c.mgDia != null && c.mgDia > 0
        ? `${formatarMgPtBr(c.mgDia)}/dia`
        : "sem previsão em mg";
    passos.push({
      rotulo: c.pacienteNome,
      detalhe: `${c.regimeTexto} → ${mgTexto}`,
    });
  }

  const somaMg = contrib.reduce((s, c) => s + (c.mgDia != null && c.mgDia > 0 ? c.mgDia : 0), 0);
  if (contrib.some((c) => c.mgDia != null && c.mgDia > 0)) {
    passos.push({
      rotulo: "Soma das contribuições",
      detalhe: `Total = ${formatarMgPtBr(somaMg)}/dia`,
    });
  }

  passos.push(...passosResultadoAgregado(previsao, periodo));

  const indisponivel = previsaoMgTemValor(previsao)
    ? null
    : "Não foi possível calcular a previsão agregada — verifique concentração e cadastro de consumo de cada paciente.";

  return {
    titulo: `Previsão agregada: ${label}`,
    intro:
      "Valores somados de todos os pacientes que usam este medicamento no cadastro.",
    passos,
    indisponivel,
  };
}

export function buildMesesEstoqueResumoAuditoria(input: BuildResumoAuditoriaInput): AuditoriaTrilha {
  const { row, pacientes } = input;
  const periodo = normalizeDiasPeriodo(input.diasPeriodo);
  const unidadePeriodo = rotuloPeriodo(periodo);
  const label = `${row.medicamento_nome} ${row.medicamento_concentracao}`.trim();
  const contrib = contribuicoesResumoPorPaciente(
    row.medicamento_nome,
    row.medicamento_concentracao,
    pacientes,
  );

  const consumoUnidDia = contrib.reduce((s, c) => s + (c.unidDia > 0 ? c.unidDia : 0), 0);
  const taxaUnid = consumoUnidDia > 0 ? consumoUnidDia : row.consumoDiarioTotal;

  const linhasMedicamentos = vinculosResumoComPaciente(
    row.medicamento_nome,
    row.medicamento_concentracao,
    pacientes,
  ).map((v) => v.medicamento);

  const previsaoMg =
    input.previsaoExibida ??
    (linhasMedicamentos.length > 0
      ? agregarPrevisaoMgMedicamentos(linhasMedicamentos)
      : row.previsaoMgTotal);
  const mgDia = previsaoMg?.mg_dia_previsto ?? null;
  const mgPorUnidade = parseMgPorUnidadeFromConcentracao(row.medicamento_concentracao);

  const mesesUnid =
    input.mesesUnidExibido ??
    (taxaUnid > 0 && row.estoqueTotal > 0
      ? Math.floor(row.estoqueTotal / (taxaUnid * periodo))
      : row.mesesEstoque ?? null);

  const estoqueMg =
    mgPorUnidade != null && row.estoqueTotal > 0 ? row.estoqueTotal * mgPorUnidade : null;
  const mesesMgCalc =
    mgDia != null && mgDia > 0 && estoqueMg != null && estoqueMg > 0
      ? Math.floor(estoqueMg / (mgDia * periodo))
      : null;
  const mesesMg = input.mesesMgExibido ?? mesesMgCalc ?? row.mesesEstoqueMg ?? null;

  const passos: PrevisaoMgAuditoriaPasso[] = [
    {
      rotulo: "Medicamento",
      detalhe: `${row.medicamento_nome} — concentração "${row.medicamento_concentracao}"`,
    },
    {
      rotulo: "Estoque total",
      detalhe: `${formatarNumeroTaxaPtBr(row.estoqueTotal)} unid. (soma de todos os lotes deste medicamento)`,
    },
    {
      rotulo: "Origem dos dados",
      detalhe:
        "Estoque físico cadastrado e consumo previsto dos pacientes vinculados. Não utiliza retiradas.",
    },
    {
      rotulo: "Linha superior — base unid./dia",
      detalhe: "Estima quantos meses o estoque dura usando consumo em unidades por dia.",
    },
  ];

  for (const c of contrib) {
    if (c.unidDia <= 0) continue;
    passos.push({
      rotulo: `${c.pacienteNome} (unid.)`,
      detalhe: `${c.regimeTexto} → ≈ ${formatarNumeroTaxaPtBr(c.unidDia)} unid./dia`,
    });
  }

  passos.push({
    rotulo: "Consumo agregado (unid.)",
    detalhe: `${formatarNumeroTaxaPtBr(taxaUnid)} unid./dia (soma dos pacientes)`,
  });

  if (taxaUnid > 0 && row.estoqueTotal > 0) {
    passos.push({
      rotulo: "Cálculo meses (unid.)",
      detalhe: `${formatarNumeroTaxaPtBr(row.estoqueTotal)} unid. ÷ (${formatarNumeroTaxaPtBr(taxaUnid)} unid./dia × ${periodo} dias) = ${mesesUnid ?? "—"} ${unidadePeriodo}`,
    });
  } else {
    passos.push({
      rotulo: "Cálculo meses (unid.)",
      detalhe: "Indisponível — consumo em unidades/dia é zero ou estoque vazio.",
    });
  }

  passos.push({
    rotulo: "Linha inferior — base mg/dia",
    detalhe:
      "Estima quantos meses o estoque dura convertendo unidades em mg e usando a previsão agregada em mg/dia.",
  });

  if (mgPorUnidade != null) {
    passos.push({
      rotulo: "Estoque em mg",
      detalhe: `${formatarNumeroTaxaPtBr(row.estoqueTotal)} unid. × ${formatarMgPtBr(mgPorUnidade)}/unid. = ${estoqueMg != null ? formatarMgPtBr(estoqueMg) : "—"}`,
    });
  } else {
    passos.push({
      rotulo: "Estoque em mg",
      detalhe: `Não foi possível converter estoque para mg a partir de "${row.medicamento_concentracao}".`,
    });
  }

  if (mgDia != null && mgDia > 0) {
    passos.push({
      rotulo: "Consumo agregado (mg)",
      detalhe: `${formatarMgPtBr(mgDia)}/dia (previsão agregada)`,
    });
  }

  if (estoqueMg != null && mgDia != null && mgDia > 0) {
    passos.push({
      rotulo: "Cálculo meses (mg)",
      detalhe: `${formatarMgPtBr(estoqueMg)} ÷ (${formatarMgPtBr(mgDia)}/dia × ${periodo} dias) = ${mesesMg ?? "—"} ${unidadePeriodo}`,
    });
  } else {
    passos.push({
      rotulo: "Cálculo meses (mg)",
      detalhe: "Indisponível — falta previsão em mg ou conversão da concentração.",
    });
  }

  return {
    titulo: `Meses de estoque: ${label}`,
    intro:
      "Duas estimativas complementares: pela 1ª linha (unidades/dia) e pela 2ª linha (mg/dia).",
    passos,
  };
}
