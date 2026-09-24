import { describe, expect, it } from "vitest";
import {
  daysBetweenIsoDates,
  shouldSendDataRetornoOnEdit,
} from "./dateUtils";

describe("daysBetweenIsoDates", () => {
  it("calcula dias entre liberação e retorno (ex. 23/09 → 23/12 = 91)", () => {
    expect(daysBetweenIsoDates("2026-09-23", "2026-12-23")).toBe(91);
  });

  it("retorna 0 quando as datas são iguais", () => {
    expect(daysBetweenIsoDates("2026-09-02", "2026-09-02")).toBe(0);
  });

  it("retorna null quando fim é anterior ao início", () => {
    expect(daysBetweenIsoDates("2026-09-30", "2026-09-02")).toBeNull();
  });

  it("retorna null para strings inválidas ou vazias", () => {
    expect(daysBetweenIsoDates("", "2026-09-30")).toBeNull();
    expect(daysBetweenIsoDates("2026-09-02", "")).toBeNull();
    expect(daysBetweenIsoDates("02/09/2026", "30/09/2026")).toBeNull();
    expect(daysBetweenIsoDates("2026-02-30", "2026-03-01")).toBeNull();
  });

  it("aceita ISO com sufixo de tempo sem deslocar o dia", () => {
    expect(
      daysBetweenIsoDates("2026-09-02T00:00:00.000Z", "2026-09-30T12:00:00.000Z"),
    ).toBe(28);
  });
});

describe("shouldSendDataRetornoOnEdit", () => {
  it("não envia quando o formulário está vazio", () => {
    expect(shouldSendDataRetornoOnEdit("", "2026-09-30")).toBe(false);
    expect(shouldSendDataRetornoOnEdit(null, "2026-09-30")).toBe(false);
  });

  it("não envia quando o valor é igual à próxima já conhecida", () => {
    expect(shouldSendDataRetornoOnEdit("2026-09-30", "2026-09-30")).toBe(false);
    expect(
      shouldSendDataRetornoOnEdit("2026-09-30", "2026-09-30T00:00:00.000Z"),
    ).toBe(false);
  });

  it("envia quando o usuário mudou a data", () => {
    expect(shouldSendDataRetornoOnEdit("2026-10-15", "2026-09-30")).toBe(true);
  });

  it("envia quando não havia próxima e o usuário preencheu", () => {
    expect(shouldSendDataRetornoOnEdit("2026-10-15", null)).toBe(true);
    expect(shouldSendDataRetornoOnEdit("2026-10-15", "")).toBe(true);
  });
});
