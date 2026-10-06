import { describe, expect, it } from "vitest";
import {
  DROPDOWN_PLACEHOLDER_VALUE,
  isPlaceholderOption,
  resolveOptionDisabled,
  withPlaceholderOption,
} from "./placeholderOption";

describe("withPlaceholderOption", () => {
  it("coloca a opção-placeholder no topo usando label/value por padrão", () => {
    const options = [{ label: "Sim", value: true }];
    const result = withPlaceholderOption(options, "Selecione sim ou não")!;

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      label: "Selecione sim ou não",
      value: DROPDOWN_PLACEHOLDER_VALUE,
      disabled: true,
    });
    expect(isPlaceholderOption(result[0])).toBe(true);
    expect(result[1]).toBe(options[0]);
  });

  it("respeita optionLabel e optionValue personalizados", () => {
    const result = withPlaceholderOption([{ name: "Comprimido", code: 1 }], "Selecione a forma", {
      optionLabel: "name",
      optionValue: "code",
    })!;

    expect(result[0]).toMatchObject({ name: "Selecione a forma", code: DROPDOWN_PLACEHOLDER_VALUE });
  });

  it("não altera lista vazia nem lista de valores primitivos", () => {
    expect(withPlaceholderOption([], "Selecione")).toEqual([]);
    expect(withPlaceholderOption(undefined, "Selecione")).toBeUndefined();
    expect(withPlaceholderOption([10, 20], "Selecione")).toEqual([10, 20]);
  });

  it("não modifica a lista original", () => {
    const options = [{ label: "A", value: "a" }];
    withPlaceholderOption(options, "Selecione");
    expect(options).toHaveLength(1);
  });
});

describe("resolveOptionDisabled", () => {
  it("usa option.disabled quando optionDisabled não é informado", () => {
    expect(resolveOptionDisabled({ disabled: true }, undefined)).toBe(true);
    expect(resolveOptionDisabled({ label: "A" }, undefined)).toBe(false);
  });

  it("usa o campo indicado por optionDisabled", () => {
    expect(resolveOptionDisabled({ bloqueado: true }, "bloqueado")).toBe(true);
    expect(resolveOptionDisabled({ bloqueado: false, disabled: true }, "bloqueado")).toBe(false);
  });

  it("usa a função indicada por optionDisabled", () => {
    const optionDisabled = (o: unknown) => (o as { value: number }).value > 1;
    expect(resolveOptionDisabled({ value: 2 }, optionDisabled)).toBe(true);
    expect(resolveOptionDisabled({ value: 1 }, optionDisabled)).toBe(false);
  });

  it("trata valores primitivos como habilitados", () => {
    expect(resolveOptionDisabled(10, undefined)).toBe(false);
  });
});
