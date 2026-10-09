import { useCallback, useMemo, useState } from "react";
import { Dropdown, type DropdownFilterEvent, type DropdownProps } from "primereact/dropdown";
import {
  isPlaceholderOption,
  resolveOptionDisabled,
  withPlaceholderOption,
} from "./placeholderOption";

export interface AppDropdownProps extends DropdownProps {
  /** Obrigatório: aparece no campo vazio e como primeira opção (desabilitada) da lista. */
  placeholder: string;
}

/**
 * `Dropdown` padrão do projeto: repete o placeholder como primeira opção desabilitada,
 * deixando claro dentro da lista o que deve ser escolhido.
 */
export function AppDropdown({
  options,
  placeholder,
  optionLabel,
  optionValue,
  optionDisabled,
  optionGroupLabel,
  onFilter,
  ...rest
}: AppDropdownProps) {
  const [filtroAtivo, setFiltroAtivo] = useState(false);

  // Durante a busca a opção-placeholder sai da lista: ela não é resultado e,
  // se casasse com o texto digitado, esconderia o `emptyFilterMessage`.
  const optionsComPlaceholder = useMemo(
    () =>
      optionGroupLabel || filtroAtivo
        ? options
        : withPlaceholderOption(options, placeholder, { optionLabel, optionValue }),
    [options, placeholder, optionLabel, optionValue, optionGroupLabel, filtroAtivo],
  );

  const isOptionDisabled = useCallback(
    (option: unknown) =>
      isPlaceholderOption(option) || resolveOptionDisabled(option, optionDisabled),
    [optionDisabled],
  );

  const handleFilter = useCallback(
    (event: DropdownFilterEvent) => {
      setFiltroAtivo(event.filter.trim().length > 0);
      onFilter?.(event);
    },
    [onFilter],
  );

  return (
    <Dropdown
      {...rest}
      options={optionsComPlaceholder}
      placeholder={placeholder}
      optionLabel={optionLabel}
      optionValue={optionValue}
      optionGroupLabel={optionGroupLabel}
      optionDisabled={isOptionDisabled}
      onFilter={handleFilter}
    />
  );
}
