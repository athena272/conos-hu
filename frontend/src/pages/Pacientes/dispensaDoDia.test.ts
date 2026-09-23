import { describe, expect, it } from "vitest";
import { suggestDispensaQuantidade } from "./dispensaDoDia";

describe("suggestDispensaQuantidade", () => {
  it("sugere unidades_por_ciclo no regime por_ciclo", () => {
    expect(
      suggestDispensaQuantidade({
        regime_consumo: "por_ciclo",
        unidades_por_ciclo: "4",
      }),
    ).toBe("4");
  });

  it("retorna vazio para regime diario", () => {
    expect(
      suggestDispensaQuantidade({
        regime_consumo: "diario",
        unidades_por_ciclo: "4",
      }),
    ).toBe("");
  });

  it("retorna vazio quando unidades inválidas", () => {
    expect(
      suggestDispensaQuantidade({
        regime_consumo: "por_ciclo",
        unidades_por_ciclo: "",
      }),
    ).toBe("");
  });
});
