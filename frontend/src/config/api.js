/**
 * URL base da API (backend).
 * Em produção: defina VITE_API_URL na Vercel (ex: https://conos-api-xxx.run.app).
 * Em desenvolvimento: usa http://localhost:3001 se não definido.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
