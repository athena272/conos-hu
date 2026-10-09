import { describe, expect, it } from "vitest";
import type { ResumoPorMedicamento } from "../../types";
import {
  areResumoFiltersActive,
  DEFAULT_RESUMO_SORT,
  filterResumoPorMedicamento,
  sortResumoPorMedicamento,
} from "./estoqueComprometidoFilters";

function row(
  partial: Partial<ResumoPorMedicamento> &
    Pick<ResumoPorMedicamento, "medicamento_nome" | "medicamento_concentracao">,
): ResumoPorMedicamento {
  return {
    qtdPacientes: 1,
    consumoDiarioTotal: 1,
    estoqueTotal: 10,
    mesesEstoque: 1,
    ...partial,
  };
}

describe("filterResumoPorMedicamento", () => {
  const list = [
    row({ medicamento_nome: "Dipirona", medicamento_concentracao: "500mg", estoqueTotal: 5 }),
    row({ medicamento_nome: "Paracetamol", medicamento_concentracao: "750mg", estoqueTotal: 20 }),
    row({ medicamento_nome: "Ibuprofeno", medicamento_concentracao: "400mg", estoqueTotal: 8 }),
  ];

  it("retorna todos quando a busca está vazia", () => {
    expect(filterResumoPorMedicamento(list, "  ").map((r) => r.medicamento_nome)).toEqual([
      "Dipirona",
      "Paracetamol",
      "Ibuprofeno",
    ]);
  });

  it("filtra por nome (case-insensitive)", () => {
    expect(filterResumoPorMedicamento(list, "para").map((r) => r.medicamento_nome)).toEqual([
      "Paracetamol",
    ]);
  });

  it("filtra por concentração", () => {
    expect(filterResumoPorMedicamento(list, "500").map((r) => r.medicamento_nome)).toEqual([
      "Dipirona",
    ]);
  });
});

describe("sortResumoPorMedicamento", () => {
  const list = [
    row({
      medicamento_nome: "Beta",
      medicamento_concentracao: "10mg",
      estoqueTotal: 5,
      qtdPacientes: 3,
      mesesEstoque: 2,
      mesesEstoqueMg: 2,
    }),
    row({
      medicamento_nome: "Alfa",
      medicamento_concentracao: "20mg",
      estoqueTotal: 30,
      qtdPacientes: 1,
      mesesEstoque: null,
      mesesEstoqueMg: null,
    }),
    row({
      medicamento_nome: "Gama",
      medicamento_concentracao: "5mg",
      estoqueTotal: 10,
      qtdPacientes: 5,
      mesesEstoque: 8,
      mesesEstoqueMg: 8,
    }),
  ];

  it("ordena por nome ascendente", () => {
    expect(sortResumoPorMedicamento(list, "nome_asc").map((r) => r.medicamento_nome)).toEqual([
      "Alfa",
      "Beta",
      "Gama",
    ]);
  });

  it("ordena por estoque descendente", () => {
    expect(sortResumoPorMedicamento(list, "estoque_desc").map((r) => r.estoqueTotal)).toEqual([
      30, 10, 5,
    ]);
  });

  it("ordena por pacientes ascendente", () => {
    expect(sortResumoPorMedicamento(list, "pacientes_asc").map((r) => r.qtdPacientes)).toEqual([
      1, 3, 5,
    ]);
  });

  it("coloca meses nulos no fim ao ordenar por meses asc", () => {
    expect(sortResumoPorMedicamento(list, "meses_asc").map((r) => r.medicamento_nome)).toEqual([
      "Beta",
      "Gama",
      "Alfa",
    ]);
  });
});

describe("areResumoFiltersActive", () => {
  it("é falso com defaults", () => {
    expect(areResumoFiltersActive("", DEFAULT_RESUMO_SORT)).toBe(false);
  });

  it("é verdadeiro com busca ou sort diferente do padrão", () => {
    expect(areResumoFiltersActive("dip", DEFAULT_RESUMO_SORT)).toBe(true);
    expect(areResumoFiltersActive("", "estoque_desc")).toBe(true);
  });
});
