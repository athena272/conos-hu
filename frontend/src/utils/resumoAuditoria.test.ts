import { describe, expect, it } from "vitest";
import type { Paciente, ResumoPorMedicamento } from "../types/paciente";
import {
  buildMesesEstoqueResumoAuditoria,
  buildPrevisaoMgResumoAuditoria,
  contribuicoesResumoPorPaciente,
} from "./resumoAuditoria";

const pacientesDemo: Paciente[] = [
  {
    id: 1,
    nome: "Maria Silva",
    prontuario: 200001,
    apac: "APAC-001",
    diagnostico: "Dor",
    medicamentos: [
      {
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        consumo_diario: 2,
        regime_consumo: "diario",
      },
    ],
    observacoes: null,
    telefone: "",
    data_liberacao: "2025-01-01",
    retorna_servico: 0,
    tipo_retorno: null,
  },
  {
    id: 2,
    nome: "Roberto Lima",
    prontuario: 200006,
    apac: "APAC-006",
    diagnostico: "Dor",
    medicamentos: [
      {
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        consumo_diario: 3,
        regime_consumo: "diario",
      },
    ],
    observacoes: null,
    telefone: "",
    data_liberacao: "2025-02-01",
    retorna_servico: 0,
    tipo_retorno: null,
  },
];

const rowParacetamol: ResumoPorMedicamento = {
  medicamento_nome: "Paracetamol",
  medicamento_concentracao: "500mg",
  qtdPacientes: 2,
  consumoDiarioTotal: 5,
  estoqueTotal: 1780,
  mesesEstoque: 8,
  mesesEstoqueMg: 8,
  previsaoMgTotal: {
    mg_dia_previsto: 2500,
    mg_mes_previsto: 75000,
    mg_contextual: 2500,
    contextual_rotulo: "mg/dia",
  },
};

describe("contribuicoesResumoPorPaciente", () => {
  it("lista cada paciente com contribuicao em mg e unid", () => {
    const c = contribuicoesResumoPorPaciente("Paracetamol", "500mg", pacientesDemo);
    expect(c).toHaveLength(2);
    expect(c[0]?.mgDia).toBe(1000);
    expect(c[1]?.mgDia).toBe(1500);
  });
});

describe("buildPrevisaoMgResumoAuditoria", () => {
  it("mostra soma por paciente e total agregado", () => {
    const trilha = buildPrevisaoMgResumoAuditoria({
      row: rowParacetamol,
      pacientes: pacientesDemo,
      previsaoExibida: rowParacetamol.previsaoMgTotal,
    });
    expect(trilha.passos.some((p) => p.rotulo === "Maria Silva")).toBe(true);
    expect(trilha.passos.some((p) => p.rotulo === "Roberto Lima")).toBe(true);
    expect(trilha.passos.some((p) => p.detalhe.includes("Total = 2.500 mg/dia"))).toBe(true);
    const texto = trilha.passos.map((p) => p.detalhe).join(" ");
    expect(texto).not.toMatch(/API|fallback|navegador/i);
  });
});

describe("buildMesesEstoqueResumoAuditoria", () => {
  it("explica calculo em unid e em mg", () => {
    const trilha = buildMesesEstoqueResumoAuditoria({
      row: rowParacetamol,
      pacientes: pacientesDemo,
      previsaoExibida: rowParacetamol.previsaoMgTotal,
      mesesUnidExibido: 8,
      mesesMgExibido: 8,
    });
    expect(trilha.passos.some((p) => p.rotulo === "Cálculo meses (unid.)")).toBe(true);
    expect(trilha.passos.some((p) => p.rotulo === "Cálculo meses (mg)")).toBe(true);
    expect(trilha.passos.some((p) => p.detalhe.includes("1.780 unid."))).toBe(true);
  });
});
