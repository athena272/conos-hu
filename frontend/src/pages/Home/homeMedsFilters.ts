import { FilterMatchMode } from "primereact/api";

export type HomeMedsFiltersState = {
  global: {
    value: string | null;
    matchMode: typeof FilterMatchMode.CONTAINS;
  };
  nome: {
    value: string | null;
    matchMode: typeof FilterMatchMode.STARTS_WITH;
  };
  status: {
    value: string | null;
    matchMode: typeof FilterMatchMode.EQUALS;
  };
};

export function createDefaultHomeMedsFilters(): HomeMedsFiltersState {
  return {
    global: {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },
    nome: {
      value: null,
      matchMode: FilterMatchMode.STARTS_WITH,
    },
    status: {
      value: null,
      matchMode: FilterMatchMode.EQUALS,
    },
  };
}

export function areHomeMedsFiltersActive(
  globalFilterValue: string,
  statusValue: string | null,
): boolean {
  return Boolean(globalFilterValue.trim() || statusValue);
}
