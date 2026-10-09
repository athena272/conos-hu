import { formatPaginationSummary } from "./paginationRange";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  summaryLabel: string;
  className?: string;
};

export function PaginationSummary({
  page,
  totalPages,
  total,
  summaryLabel,
  className,
}: Props) {
  const classes = ["pagination-summary", className].filter(Boolean).join(" ");

  return (
    <p className={classes}>
      {formatPaginationSummary(total, summaryLabel, page, totalPages)}
    </p>
  );
}
