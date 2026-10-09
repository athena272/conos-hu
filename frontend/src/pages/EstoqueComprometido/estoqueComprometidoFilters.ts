import type { ResumoPorMedicamento } from "../../types";

export type ResumoSortKey =
  | "nome_asc"
  | "nome_desc"
  | "estoque_desc"
  | "estoque_asc"
  | "pacientes_desc"
  | "pacientes_asc"
  | "meses_asc"
  | "meses_desc";

export const RESUMO_SORT_OPTIONS: { label: string; value: ResumoSortKey }[] = [
  { label: "Medicamento (A–Z)", value: "nome_asc" },
  { label: "Medicamento (Z–A)", value: "nome_desc" },
  { label: "Estoque (maior)", value: "estoque_desc" },
  { label: "Estoque (menor)", value: "estoque_asc" },
  { label: "Pacientes (mais)", value: "pacientes_desc" },
  { label: "Pacientes (menos)", value: "pacientes_asc" },
  { label: "Meses de estoque (menor)", value: "meses_asc" },
  { label: "Meses de estoque (maior)", value: "meses_desc" },
];

export const DEFAULT_RESUMO_SORT: ResumoSortKey = "nome_asc";

function normalizeBusca(value: string): string {
  return value.trim().toLowerCase();
}

/** Filtra por nome ou concentração (case-insensitive, substring). */
export function filterResumoPorMedicamento(
  rows: ResumoPorMedicamento[],
  busca: string,
): ResumoPorMedicamento[] {
  const q = normalizeBusca(busca);
  if (!q) return rows;
  return rows.filter((row) => {
    const nome = row.medicamento_nome.toLowerCase();
    const conc = row.medicamento_concentracao.toLowerCase();
    const combined = `${nome} ${conc}`;
    return nome.includes(q) || conc.includes(q) || combined.includes(q);
  });
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: "asc" | "desc",
): number {
  const aNull = a == null || Number.isNaN(a);
  const bNull = b == null || Number.isNaN(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return direction === "asc" ? a! - b! : b! - a!;
}

function compareText(a: string, b: string, direction: "asc" | "desc"): number {
  const cmp = a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

/** Ordena cópia da lista conforme `sortKey`. */
export function sortResumoPorMedicamento(
  rows: ResumoPorMedicamento[],
  sortKey: ResumoSortKey,
): ResumoPorMedicamento[] {
  const list = [...rows];
  list.sort((a, b) => {
    switch (sortKey) {
      case "nome_asc":
        return (
          compareText(a.medicamento_nome, b.medicamento_nome, "asc") ||
          compareText(a.medicamento_concentracao, b.medicamento_concentracao, "asc")
        );
      case "nome_desc":
        return (
          compareText(a.medicamento_nome, b.medicamento_nome, "desc") ||
          compareText(a.medicamento_concentracao, b.medicamento_concentracao, "desc")
        );
      case "estoque_asc":
        return a.estoqueTotal - b.estoqueTotal;
      case "estoque_desc":
        return b.estoqueTotal - a.estoqueTotal;
      case "pacientes_asc":
        return a.qtdPacientes - b.qtdPacientes;
      case "pacientes_desc":
        return b.qtdPacientes - a.qtdPacientes;
      case "meses_asc":
        return compareNullableNumber(
          a.mesesEstoqueMg ?? a.mesesEstoque,
          b.mesesEstoqueMg ?? b.mesesEstoque,
          "asc",
        );
      case "meses_desc":
        return compareNullableNumber(
          a.mesesEstoqueMg ?? a.mesesEstoque,
          b.mesesEstoqueMg ?? b.mesesEstoque,
          "desc",
        );
      default:
        return 0;
    }
  });
  return list;
}

export function areResumoFiltersActive(
  busca: string,
  sortKey: ResumoSortKey,
): boolean {
  return Boolean(normalizeBusca(busca)) || sortKey !== DEFAULT_RESUMO_SORT;
}
