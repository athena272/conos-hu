import type { DropdownProps } from "primereact/dropdown";

/** Valor da opção-placeholder; nunca é selecionável porque a opção é sempre desabilitada. */
export const DROPDOWN_PLACEHOLDER_VALUE = "__dropdown_placeholder__";

const PLACEHOLDER_FLAG = "__isPlaceholderOption";

type OptionRecord = Record<string, unknown>;

interface PlaceholderOptionKeys {
  optionLabel?: string;
  optionValue?: string;
}

function isOptionRecord(option: unknown): option is OptionRecord {
  return option !== null && typeof option === "object";
}

export function isPlaceholderOption(option: unknown): boolean {
  return isOptionRecord(option) && option[PLACEHOLDER_FLAG] === true;
}

/**
 * Coloca no topo da lista uma opção desabilitada com o texto do placeholder.
 * Listas vazias continuam vazias (para o `emptyMessage` aparecer) e listas de valores
 * primitivos não são alteradas, porque não comportam a opção extra.
 */
export function withPlaceholderOption<T>(
  options: readonly T[] | undefined,
  placeholder: string,
  { optionLabel = "label", optionValue = "value" }: PlaceholderOptionKeys = {},
): Array<T | OptionRecord> | undefined {
  if (!options || options.length === 0 || !options.every(isOptionRecord)) {
    return options ? [...options] : options;
  }
  // `disabled` precisa estar na própria opção: o clique do PrimeReact checa só `option.disabled`.
  const placeholderOption: OptionRecord = {
    [optionLabel]: placeholder,
    [optionValue]: DROPDOWN_PLACEHOLDER_VALUE,
    [PLACEHOLDER_FLAG]: true,
    disabled: true,
  };
  return [placeholderOption, ...options];
}

/** Mesma regra do PrimeReact para `optionDisabled` (função, nome de campo ou `option.disabled`). */
export function resolveOptionDisabled(
  option: unknown,
  optionDisabled: DropdownProps["optionDisabled"],
): boolean {
  if (typeof optionDisabled === "function") return Boolean(optionDisabled(option));
  if (!isOptionRecord(option)) return false;
  if (typeof optionDisabled === "string" && optionDisabled) return Boolean(option[optionDisabled]);
  return Boolean(option.disabled);
}
