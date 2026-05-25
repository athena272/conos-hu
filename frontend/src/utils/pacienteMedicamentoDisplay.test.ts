import { describe, expect, it } from "vitest";
import type { PacienteMedicamento } from "../types/paciente";
import {
  agregarPrevisaoMgMedicamentos,
  buildPrevisaoMgFromMedicamento,
  getNotaPrevisaoMgIndisponivel,
  mesesEstoqueFromMgFrontend,
  normalizePacienteLista,
  normalizePrevisaoMgFromApi,
  previsaoMgTemValor,
  resolvePrevisaoMgMedicamento,
} from "./pacienteMedicamentoDisplay";

function med(
  partial: Partial<PacienteMedicamento> & Pick<PacienteMedicamento, "medicamento_nome" | "medicamento_concentracao">,
): PacienteMedicamento {
  return {
    consumo_diario: 1,
    regime_consumo: "diario",
    ...partial,
  };
}

describe("previsaoMgTemValor", () => {
  it("retorna false quando previsao e undefined (nao confundir com erro de concentracao)", () => {
    expect(previsaoMgTemValor(undefined)).toBe(false);
  });

  it("retorna false quando mg_dia_previsto e null", () => {
    expect(
      previsaoMgTemValor({
        mg_dia_previsto: null,
        mg_mes_previsto: null,
        mg_contextual: null,
        contextual_rotulo: "mg/dia",
      }),
    ).toBe(false);
  });

  it("retorna true quando ha mg/dia valido", () => {
    expect(
      previsaoMgTemValor({
        mg_dia_previsto: 1000,
        mg_mes_previsto: 30000,
        mg_contextual: 1000,
        contextual_rotulo: "mg/dia",
      }),
    ).toBe(true);
  });
});

describe("normalizePrevisaoMgFromApi", () => {
  it("aceita snake_case e camelCase", () => {
    expect(
      normalizePrevisaoMgFromApi({
        mg_dia_previsto: 500,
        mg_mes_previsto: 15000,
        mg_contextual: 500,
        contextual_rotulo: "mg/dia",
      })?.mg_dia_previsto,
    ).toBe(500);
    expect(
      normalizePrevisaoMgFromApi({
        mgDiaPrevisto: 750,
        mgMesPrevisto: 22500,
        mgContextual: 750,
        contextualRotulo: "mg/dia",
      })?.mg_dia_previsto,
    ).toBe(750);
  });

  it("retorna undefined quando objeto de previsao esta ausente", () => {
    expect(normalizePrevisaoMgFromApi(undefined)).toBeUndefined();
    expect(normalizePrevisaoMgFromApi({})).toBeUndefined();
  });
});

describe("resolvePrevisaoMgMedicamento / buildPrevisaoMgFromMedicamento", () => {
  it("calcula 1.000 mg/dia para Paracetamol 500mg com 2 comp/dia", () => {
    const m = med({
      medicamento_nome: "Paracetamol",
      medicamento_concentracao: "500mg",
      consumo_diario: 2,
    });
    const p = resolvePrevisaoMgMedicamento(m);
    expect(p.mg_dia_previsto).toBe(1000);
    expect(p.mg_mes_previsto).toBe(30000);
  });

  it("calcula por miligrama sem depender da concentracao", () => {
    const m = med({
      medicamento_nome: "Metformina",
      medicamento_concentracao: "850mg",
      consumo_diario: 0,
      regime_consumo: "por_miligrama",
      consumo_mg_diario: 1700,
    });
    expect(resolvePrevisaoMgMedicamento(m).mg_dia_previsto).toBe(1700);
  });

  it("recalcula quando API envia previsao_mg com todos os campos null", () => {
    const m = med({
      medicamento_nome: "Omeprazol",
      medicamento_concentracao: "20mg",
      consumo_diario: 1,
      previsao_mg: {
        mg_dia_previsto: null,
        mg_mes_previsto: null,
        mg_contextual: null,
        contextual_rotulo: "mg/dia",
      },
    });
    expect(resolvePrevisaoMgMedicamento(m).mg_dia_previsto).toBe(20);
  });
});

describe("normalizePacienteLista — fallback quando API omite previsao_mg", () => {
  it("preenche previsao_mg a partir do vinculo (regressao UI 'Concentracao sem mg')", () => {
    const pacientes = normalizePacienteLista([
      {
        id: 1,
        nome: "Maria Silva",
        prontuario: 200001,
        apac: "APAC-001",
        diagnostico: "Dor cronica",
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
        data_liberacao: "2025-01-15",
        retorna_servico: 0,
        tipo_retorno: null,
      },
    ]);

    const previsao = pacientes[0]?.medicamentos[0]?.previsao_mg;
    expect(previsaoMgTemValor(previsao)).toBe(true);
    expect(previsao?.mg_dia_previsto).toBe(1000);
  });

  it("nao exibe nota de concentracao quando previsao foi calculada localmente", () => {
    const m = normalizePacienteLista([
      {
        id: 1,
        nome: "Maria",
        prontuario: 1,
        apac: "A",
        diagnostico: "D",
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
    ])[0]!.medicamentos[0]!;

    expect(getNotaPrevisaoMgIndisponivel(m)).toBeNull();
  });
});

describe("getNotaPrevisaoMgIndisponivel", () => {
  it("so mostra 'Concentracao sem mg' quando realmente nao ha mg parseavel", () => {
    const m = med({
      medicamento_nome: "X",
      medicamento_concentracao: "1 g",
      consumo_diario: 2,
    });
    expect(getNotaPrevisaoMgIndisponivel(m)).toBe(
      "Concentração sem mg no cadastro",
    );
  });

  it("nao mostra nota para 500mg com consumo diario valido", () => {
    const m = buildPrevisaoMgFromMedicamento(
      med({
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        consumo_diario: 2,
      }),
    );
    const withPrevisao = med({
      medicamento_nome: "Paracetamol",
      medicamento_concentracao: "500mg",
      consumo_diario: 2,
      previsao_mg: m,
    });
    expect(getNotaPrevisaoMgIndisponivel(withPrevisao)).toBeNull();
  });

  it("orienta cadastro de mg/dia no regime por_miligrama sem consumo", () => {
    const m = med({
      medicamento_nome: "Metformina",
      medicamento_concentracao: "850mg",
      consumo_diario: 0,
      regime_consumo: "por_miligrama",
      consumo_mg_diario: null,
    });
    expect(getNotaPrevisaoMgIndisponivel(m)).toBe(
      "Informe consumo em mg/dia no cadastro",
    );
  });
});

describe("agregarPrevisaoMgMedicamentos", () => {
  it("soma previsoes de varios pacientes no mesmo medicamento", () => {
    const linhas = [
      med({
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        consumo_diario: 2,
      }),
      med({
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        consumo_diario: 3,
      }),
    ];
    const agg = agregarPrevisaoMgMedicamentos(linhas);
    expect(agg.mg_dia_previsto).toBe(2500);
  });
});

describe("mesesEstoqueFromMgFrontend", () => {
  it("calcula meses com base em estoque e mg/dia agregado", () => {
    // 1780 un × 500mg = 890000 mg; 3500 mg/dia × 30 = 105000/mês → 8 meses
    expect(mesesEstoqueFromMgFrontend(1780, 3500, "500mg")).toBe(8);
  });
});
