import { describe, expect, it } from "vitest";
import { normalizeResumoPorMedicamentoLista } from "./normalizeResumoPorMedicamento";

describe("normalizeResumoPorMedicamentoLista", () => {
  it("normaliza previsaoMgTotal e mesesEstoqueMg em camelCase", () => {
    const [row] = normalizeResumoPorMedicamentoLista([
      {
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        qtdPacientes: 2,
        consumoDiarioTotal: 5,
        estoqueTotal: 1780,
        mesesEstoque: 8,
        mesesEstoqueMg: 8,
        previsaoMgTotal: {
          mgDiaPrevisto: 2500,
          mgMesPrevisto: 75000,
          mgContextual: 2500,
          contextualRotulo: "mg/dia",
        },
      },
    ]);

    expect(row.previsaoMgTotal?.mg_dia_previsto).toBe(2500);
    expect(row.mesesEstoqueMg).toBe(8);
  });

  it("aceita snake_case da API", () => {
    const [row] = normalizeResumoPorMedicamentoLista([
      {
        medicamento_nome: "Omeprazol",
        medicamento_concentracao: "20mg",
        qtdPacientes: 1,
        consumoDiarioTotal: 1,
        estoqueTotal: 210,
        mesesEstoque: 3,
        meses_estoque_mg: 3,
        previsao_mg_total: {
          mg_dia_previsto: 20,
          mg_mes_previsto: 600,
          mg_contextual: 20,
          contextual_rotulo: "mg/dia",
        },
      },
    ]);

    expect(row.previsaoMgTotal?.mg_dia_previsto).toBe(20);
    expect(row.mesesEstoqueMg).toBe(3);
  });

  it("nao inclui previsaoMgTotal vazia (forca fallback no resumo da UI)", () => {
    const [row] = normalizeResumoPorMedicamentoLista([
      {
        medicamento_nome: "Paracetamol",
        medicamento_concentracao: "500mg",
        qtdPacientes: 1,
        consumoDiarioTotal: 2,
        estoqueTotal: 100,
        mesesEstoque: 1,
        previsaoMgTotal: {
          mg_dia_previsto: null,
          mg_mes_previsto: null,
          mg_contextual: null,
          contextual_rotulo: "mg/dia",
        },
      },
    ]);

    expect(row.previsaoMgTotal).toBeUndefined();
  });
});
