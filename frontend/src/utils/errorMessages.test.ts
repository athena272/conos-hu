import { describe, expect, it } from "vitest";
import { normalizeErrorMessage } from "./errorMessages";

describe("normalizeErrorMessage", () => {
  it("prioriza a mensagem do backend", () => {
    expect(
      normalizeErrorMessage({ response: { data: { error: "Lote fora da validade" } } }),
    ).toBe("Lote fora da validade");
  });

  it("traduz erros conhecidos do axios", () => {
    expect(normalizeErrorMessage({ message: "Network Error" })).toBe(
      "Erro de rede. Verifique sua conexão.",
    );
    expect(normalizeErrorMessage({ message: "timeout of 10000ms exceeded" })).toBe(
      "A requisição demorou muito. Tente novamente.",
    );
  });

  it("traduz timeout de qualquer duração", () => {
    expect(normalizeErrorMessage({ message: "timeout of 30000ms exceeded" })).toBe(
      "A requisição demorou muito. Tente novamente.",
    );
  });

  it("usa mensagem genérica para erros desconhecidos", () => {
    expect(normalizeErrorMessage({ message: "algo estranho" })).toBe(
      "Erro inesperado. Tente novamente.",
    );
    expect(normalizeErrorMessage(undefined)).toBe("Erro inesperado. Tente novamente.");
  });
});
