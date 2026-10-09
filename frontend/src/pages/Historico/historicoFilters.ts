export type HistoricoContentFilters = {
  acaoFilter: string | null;
  entidadeFilter: string | null;
  dataInicio: string;
  dataFim: string;
  searchInput: string;
};

export function areHistoricoContentFiltersActive(
  filters: HistoricoContentFilters,
): boolean {
  return Boolean(
    filters.acaoFilter ||
      filters.entidadeFilter ||
      filters.dataInicio.trim() ||
      filters.dataFim.trim() ||
      filters.searchInput.trim(),
  );
}

export function createDefaultHistoricoContentFilters(): HistoricoContentFilters {
  return {
    acaoFilter: null,
    entidadeFilter: null,
    dataInicio: "",
    dataFim: "",
    searchInput: "",
  };
}
