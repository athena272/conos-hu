/**
 * URL base da API (backend).
 * Em produção: defina VITE_API_URL na Vercel do frontend (ex: URL do segundo
 * projeto da API na Vercel ou https://conos-api-xxx.run.app no Cloud Run).
 * Em desenvolvimento: usa http://localhost:3001 se não definido.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
