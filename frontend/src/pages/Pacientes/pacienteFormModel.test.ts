import { describe, expect, it } from "vitest";
import type { Paciente } from "../../types";
import {
  buildEditFormInitialValues,
  buildImpactoEstoquePath,
  buildPayload,
  formatTipoRetorno,
  initialFormValues,
  type FormValues,
} from "./pacienteFormModel";

function baseValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    ...initialFormValues,
    nome: "Ana",
    prontuario: "123",
    apac: "APAC1",
    diagnostico: "Dx",
    data_liberacao: "2026-09-01",
    medicamentos: [
      {
        medicamento: { nome: "Dipirona", concentracao: "500mg" },
        regime_consumo: "diario",
        consumo_diario: "2",
        unidades_por_ciclo: "",
        intervalo_ciclo_dias: "",
        consumo_mg_diario: "",
      },
    ],
    ...overrides,
  };
}

describe("buildImpactoEstoquePath", () => {
  it("monta query diário", () => {
    expect(
      buildImpactoEstoquePath({
        medicamento_nome: "Dipirona",
        medicamento_concentracao: "500mg",
        regime_consumo: "diario",
        consumo_diario: 2,
      }),
    ).toBe(
      "/pacientes/impacto-estoque?medicamento_nome=Dipirona&medicamento_concentracao=500mg&regime_consumo=diario&consumo_diario=2",
    );
  });

  it("monta query por_ciclo", () => {
    expect(
      buildImpactoEstoquePath({
        medicamento_nome: "X",
        medicamento_concentracao: "1mg",
        regime_consumo: "por_ciclo",
        consumo_diario: 0,
        unidades_por_ciclo: 10,
        intervalo_ciclo_dias: 28,
      }),
    ).toContain("regime_consumo=por_ciclo");
  });

  it("monta query por_miligrama com intervalo", () => {
    const path = buildImpactoEstoquePath({
      medicamento_nome: "Y",
      medicamento_concentracao: "10mg",
      regime_consumo: "por_miligrama",
      consumo_diario: 0,
      consumo_mg_diario: 5,
      intervalo_ciclo_dias: 7,
    });
    expect(path).toContain("regime_consumo=por_miligrama");
    expect(path).toContain("consumo_mg_diario=5");
    expect(path).toContain("intervalo_ciclo_dias=7");
  });
});

describe("formatTipoRetorno", () => {
  it("formata tipos conhecidos e nulo", () => {
    expect(formatTipoRetorno(null)).toBe("—");
    expect(formatTipoRetorno("somente_farmacia")).toBe("Somente farmácia");
    expect(formatTipoRetorno("outro")).toBe("outro");
  });
});

describe("buildPayload", () => {
  it("serializa regime diário", () => {
    const payload = buildPayload(baseValues());
    expect(payload.medicamentos).toEqual([
      {
        medicamento_nome: "Dipirona",
        medicamento_concentracao: "500mg",
        consumo_diario: 2,
        regime_consumo: "diario",
        unidades_por_ciclo: null,
        intervalo_ciclo_dias: null,
      },
    ]);
  });

  it("serializa por_ciclo e por_miligrama", () => {
    const porCiclo = buildPayload(
      baseValues({
        medicamentos: [
          {
            medicamento: { nome: "A", concentracao: "1mg" },
            regime_consumo: "por_ciclo",
            consumo_diario: "",
            unidades_por_ciclo: "10,5",
            intervalo_ciclo_dias: "28",
            consumo_mg_diario: "",
          },
        ],
      }),
    );
    expect((porCiclo.medicamentos as unknown[])[0]).toMatchObject({
      regime_consumo: "por_ciclo",
      unidades_por_ciclo: 10.5,
      intervalo_ciclo_dias: 28,
      consumo_diario: 0,
    });

    const porMg = buildPayload(
      baseValues({
        medicamentos: [
          {
            medicamento: { nome: "B", concentracao: "2mg" },
            regime_consumo: "por_miligrama",
            consumo_diario: "",
            unidades_por_ciclo: "",
            intervalo_ciclo_dias: "",
            consumo_mg_diario: "3,2",
          },
        ],
      }),
    );
    expect((porMg.medicamentos as unknown[])[0]).toMatchObject({
      regime_consumo: "por_miligrama",
      consumo_mg_diario: 3.2,
      intervalo_ciclo_dias: 1,
    });
  });

  it("no create inclui data_retorno quando preenchida", () => {
    const payload = buildPayload(
      baseValues({
        retorna_servico: true,
        tipo_retorno: "somente_farmacia",
        data_retorno: "2026-10-01",
      }),
    );
    expect(payload.data_retorno).toBe("2026-10-01");
  });

  it("no edit omite data_retorno se igual à próxima já conhecida", () => {
    const payload = buildPayload(
      baseValues({
        retorna_servico: true,
        tipo_retorno: "somente_farmacia",
        data_retorno: "2026-10-01",
      }),
      { proximaDataRetornoInicial: "2026-10-01" },
    );
    expect(payload.data_retorno).toBeUndefined();
  });

  it("no edit envia data_retorno se o usuário alterou", () => {
    const payload = buildPayload(
      baseValues({
        retorna_servico: true,
        tipo_retorno: "somente_farmacia",
        data_retorno: "2026-11-01",
      }),
      { proximaDataRetornoInicial: "2026-10-01" },
    );
    expect(payload.data_retorno).toBe("2026-11-01");
  });
});

describe("buildEditFormInitialValues", () => {
  it("preenche formulário a partir do paciente e catálogo", () => {
    const paciente = {
      id: 1,
      nome: "Ana",
      prontuario: 10,
      apac: "A",
      diagnostico: "D",
      observacoes: null,
      telefone: "1199",
      data_liberacao: "2026-09-01",
      retorna_servico: true,
      tipo_retorno: "somente_farmacia",
      proxima_data_retorno: "2026-10-01",
      medicamentos: [
        {
          medicamento_nome: "Dipirona",
          medicamento_concentracao: "500mg",
          consumo_diario: 2,
          regime_consumo: "diario",
        },
      ],
    } as Paciente;

    const values = buildEditFormInitialValues(paciente, [
      { nome: "Dipirona", concentracao: "500mg" },
    ]);
    expect(values.nome).toBe("Ana");
    expect(values.data_liberacao).toBe("2026-09-01");
    expect(values.data_retorno).toBe("2026-10-01");
    expect(values.medicamentos[0].regime_consumo).toBe("diario");
    expect(values.medicamentos[0].consumo_diario).toBe("2");
    expect(values.medicamentos[0].medicamento).toEqual({
      nome: "Dipirona",
      concentracao: "500mg",
    });
  });
});
