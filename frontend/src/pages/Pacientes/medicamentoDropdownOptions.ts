import type { MedicamentoDistinto } from "../../types";

export interface MedicamentoDropdownOption {
  label: string;
  value: MedicamentoDistinto;
}

/**
 * Ordena medicamentos por nome e concentração (pt-BR, ignora acentos/case).
 */
export function sortMedicamentosDistintos(
  items: MedicamentoDistinto[],
): MedicamentoDistinto[] {
  return [...items].sort((a, b) => {
    const byNome = a.nome.localeCompare(b.nome, "pt-BR", {
      sensitivity: "base",
    });
    if (byNome !== 0) return byNome;
    return a.concentracao.localeCompare(b.concentracao, "pt-BR", {
      sensitivity: "base",
      numeric: true,
    });
  });
}

export function buildMedicamentoDropdownOptions(
  items: MedicamentoDistinto[],
): MedicamentoDropdownOption[] {
  return sortMedicamentosDistintos(items).map((m) => ({
    label: `${m.nome} - ${m.concentracao}`,
    value: m,
  }));
}
