import { describe, expect, it } from "vitest";
import {
  buildMedicamentoDropdownOptions,
  sortMedicamentosDistintos,
} from "./medicamentoDropdownOptions";

describe("sortMedicamentosDistintos", () => {
  it("ordena alfabeticamente por nome e concentração (pt-BR)", () => {
    const sorted = sortMedicamentosDistintos([
      { nome: "Tamoxifeno", concentracao: "20mg" },
      { nome: "Anastrozol", concentracao: "1mg" },
      { nome: "anastrozol", concentracao: "10mg" },
      { nome: "Ácido zoledrônico", concentracao: "4mg" },
    ]);
    expect(sorted.map((m) => `${m.nome}|${m.concentracao}`)).toEqual([
      "Ácido zoledrônico|4mg",
      "Anastrozol|1mg",
      "anastrozol|10mg",
      "Tamoxifeno|20mg",
    ]);
  });
});

describe("buildMedicamentoDropdownOptions", () => {
  it("gera labels e preserva value ordenado", () => {
    const options = buildMedicamentoDropdownOptions([
      { nome: "B", concentracao: "2mg" },
      { nome: "A", concentracao: "1mg" },
    ]);
    expect(options.map((o) => o.label)).toEqual(["A - 1mg", "B - 2mg"]);
    expect(options[0].value).toEqual({ nome: "A", concentracao: "1mg" });
  });
});
