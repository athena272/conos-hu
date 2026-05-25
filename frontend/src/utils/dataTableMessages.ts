export interface DataTableEmptyMessageOptions {
  loading: boolean;
  error: string | null;
  emptyLabel: string;
  loadingLabel?: string;
  errorPrefix?: string;
}

const DEFAULT_LOADING = "Carregando...";
const DEFAULT_ERROR_PREFIX = "Não foi possível carregar os dados.";

export function getDataTableEmptyMessage(
  opts: DataTableEmptyMessageOptions,
): string {
  if (opts.loading) {
    return opts.loadingLabel ?? DEFAULT_LOADING;
  }
  if (opts.error) {
    const prefix = opts.errorPrefix ?? DEFAULT_ERROR_PREFIX;
    return `${prefix} ${opts.error}`;
  }
  return opts.emptyLabel;
}
