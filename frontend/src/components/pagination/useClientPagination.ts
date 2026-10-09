import { useCallback, useMemo, useState } from "react";
import { clampPage, firstFromPage, pageFromFirst } from "./paginationRange";

type Options = {
  rows?: number;
  total: number;
};

/**
 * Client-side pagination state compatible with PrimeReact DataTable `first`/`rows`.
 */
export function useClientPagination({ rows = 10, total }: Options) {
  const [first, setFirst] = useState(0);
  const { page, totalPages } = useMemo(
    () => pageFromFirst(first, rows, total),
    [first, rows, total],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const safeTotalPages = Math.max(1, Math.ceil(total / Math.max(1, rows)) || 1);
      setFirst(firstFromPage(nextPage, rows, safeTotalPages));
    },
    [rows, total],
  );

  const resetPage = useCallback(() => {
    setFirst(0);
  }, []);

  const onPrimePage = useCallback((event: { first: number }) => {
    setFirst(event.first);
  }, []);

  /** Slice helper for tables that filter outside DataTable. */
  const slice = useCallback(
    <T,>(items: T[]): T[] => {
      const safePage = clampPage(page, totalPages);
      const start = (safePage - 1) * rows;
      return items.slice(start, start + rows);
    },
    [page, rows, totalPages],
  );

  return {
    first,
    rows,
    page,
    totalPages,
    setPage,
    setFirst,
    resetPage,
    onPrimePage,
    slice,
  };
}
