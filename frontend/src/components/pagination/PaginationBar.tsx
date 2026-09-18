import { FormEvent, useEffect, useId, useState } from "react";
import { PaginationSummary } from "./PaginationSummary";
import { clampPage, getVisiblePages } from "./paginationRange";
import "./pagination.css";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  summaryLabel: string;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function PaginationBar({
  page,
  totalPages,
  total,
  summaryLabel,
  onPageChange,
  disabled = false,
}: Props) {
  const gotoId = useId();
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = clampPage(page, safeTotalPages);
  const [gotoValue, setGotoValue] = useState(String(safePage));
  const visiblePages = getVisiblePages(safePage, safeTotalPages);
  const atFirst = safePage <= 1;
  const atLast = safePage >= safeTotalPages;
  const controlsDisabled = disabled || safeTotalPages <= 1;

  useEffect(() => {
    setGotoValue(String(safePage));
  }, [safePage]);

  function goTo(next: number) {
    const clamped = clampPage(next, safeTotalPages);
    if (clamped === safePage) return;
    onPageChange(clamped);
  }

  function handleGotoSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(gotoValue);
    if (!Number.isFinite(parsed)) {
      setGotoValue(String(safePage));
      return;
    }
    goTo(parsed);
  }

  return (
    <div className="pagination-bar" role="navigation" aria-label="Paginação">
      <PaginationSummary
        page={safePage}
        totalPages={safeTotalPages}
        total={total}
        summaryLabel={summaryLabel}
      />

      <div className="pagination-controls">
        <button
          className="pagination-btn"
          type="button"
          disabled={controlsDisabled || atFirst}
          onClick={() => goTo(1)}
        >
          Primeira
        </button>
        <button
          className="pagination-btn"
          type="button"
          disabled={controlsDisabled || atFirst}
          onClick={() => goTo(safePage - 1)}
        >
          Anterior
        </button>

        <div className="pagination-pages" aria-label="Páginas">
          {visiblePages.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={item}
                className={`pagination-btn pagination-page${item === safePage ? " is-current" : ""}`}
                type="button"
                disabled={controlsDisabled}
                aria-current={item === safePage ? "page" : undefined}
                onClick={() => goTo(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          className="pagination-btn pagination-btn--accent"
          type="button"
          disabled={controlsDisabled || atLast}
          onClick={() => goTo(safePage + 1)}
        >
          Próxima
        </button>
        <button
          className="pagination-btn"
          type="button"
          disabled={controlsDisabled || atLast}
          onClick={() => goTo(safeTotalPages)}
        >
          Última
        </button>

        <form className="pagination-goto" onSubmit={handleGotoSubmit}>
          <label className="pagination-goto-label" htmlFor={gotoId}>
            Ir para
          </label>
          <input
            id={gotoId}
            type="number"
            min={1}
            max={safeTotalPages}
            inputMode="numeric"
            value={gotoValue}
            disabled={controlsDisabled}
            onChange={(event) => setGotoValue(event.target.value)}
            aria-label="Número da página"
          />
          <button
            className="pagination-btn pagination-btn--accent"
            type="submit"
            disabled={controlsDisabled}
          >
            Ir
          </button>
        </form>
      </div>
    </div>
  );
}
