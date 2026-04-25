/** Formata created_at como string compatível com o antigo MySQL (YYYY-MM-DD HH:mm:ss). */
export function formatMysqlTimestamp(v: unknown): string | undefined {
  if (v instanceof Date) {
    return v.toISOString().slice(0, 19).replace("T", " ");
  }
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

export function dateOnly(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v);
}
