import type { DropdownProps } from "primereact/dropdown";

export interface DropdownFilterOptions {
  /** Id do campo de busca interno (o navegador exige id ou name em todo campo de formulário). */
  id: string;
  placeholder: string;
}

export type DropdownFilterProps = Pick<DropdownProps, "filter" | "filterPlaceholder" | "pt">;

/**
 * Busca do `Dropdown` do PrimeReact com placeholder e id no campo interno.
 * O PrimeReact 10 não expõe `filterInputProps`; o id vai pelo pass-through `pt.filterInput`.
 */
export function buildDropdownFilterProps({ id, placeholder }: DropdownFilterOptions): DropdownFilterProps {
  return {
    filter: true,
    filterPlaceholder: placeholder,
    pt: { filterInput: { id, "aria-label": placeholder } },
  };
}
