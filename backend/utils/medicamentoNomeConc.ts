/**
 * Normaliza texto de medicamento para comparação:
 * trim, colapsa espaços internos, lower-case.
 */
export function normalizeMedicamentoText(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Normaliza concentração para comparação: remove todos os espaços + lower-case.
 * Assim "1mg", "1 mg" e "1MG" caem na mesma chave.
 */
export function normalizeMedicamentoConcentracao(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Chave estável nome\0concentração para agrupamento (ignora lote). */
export function medicamentoNomeConcMatchKey(nome: string, concentracao: string): string {
  return `${normalizeMedicamentoText(nome)}\0${normalizeMedicamentoConcentracao(concentracao)}`;
}

/**
 * Forma de exibição/persistência: trim + colapso de espaços (sem lower-case).
 */
export function canonicalizeMedicamentoDisplay(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
