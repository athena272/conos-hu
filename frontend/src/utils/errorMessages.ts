/**
 * Normaliza mensagens de erro para exibição em português.
 * Prioriza message/error do backend (já em PT), depois mapeia erros conhecidos em inglês.
 */
const EN_TO_PT: Record<string, string> = {
  "Network Error": "Erro de rede. Verifique sua conexão.",
  "Request failed with status code 401": "Não autorizado.",
  "Request failed with status code 403": "Acesso negado.",
  "Request failed with status code 404": "Recurso não encontrado.",
  "Request failed with status code 500": "Erro interno do servidor. Tente novamente mais tarde.",
  "timeout of 10000ms exceeded": "A requisição demorou muito. Tente novamente.",
};

const FALLBACK = "Erro inesperado. Tente novamente.";
const TIMEOUT_MESSAGE = "A requisição demorou muito. Tente novamente.";
const AXIOS_TIMEOUT_PATTERN = /^timeout of \d+ms exceeded$/;

interface AxiosLikeError {
  message?: string;
  code?: string;
  response?: {
    status?: number;
    data?: { message?: string; error?: string };
  };
}

export function normalizeErrorMessage(error: unknown): string {
  const err = error as AxiosLikeError | undefined;
  if (!err) return FALLBACK;

  const fromResponse =
    err.response?.data?.message ?? err.response?.data?.error;
  if (typeof fromResponse === "string" && fromResponse.trim()) {
    return fromResponse.trim();
  }

  const msg = err.message ?? "";
  if (EN_TO_PT[msg]) return EN_TO_PT[msg];
  return AXIOS_TIMEOUT_PATTERN.test(msg) ? TIMEOUT_MESSAGE : FALLBACK;
}
