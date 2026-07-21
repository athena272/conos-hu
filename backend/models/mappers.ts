const DISPLAY_TIMEZONE = "America/Sao_Paulo";

/**
 * Formata um instante como YYYY-MM-DD HH:mm:ss no fuso de Brasília.
 * MongoDB guarda Date em UTC; toISOString() sozinho exibia UTC e parecia "3h adiantado".
 */
export function formatMysqlTimestamp(v: unknown): string | undefined {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return undefined;
    return formatDatePartsInTimeZone(v, DISPLAY_TIMEZONE);
  }
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

export function dateOnly(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v);
}

function formatDatePartsInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}
