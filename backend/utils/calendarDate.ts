const DISPLAY_TIMEZONE = "America/Sao_Paulo";

/**
 * Dia civil atual em America/Sao_Paulo como YYYY-MM-DD.
 * Evita usar `toISOString().slice(0, 10)` (UTC), que após ~21h BRT
 * já aponta para o dia seguinte.
 */
export function todayIsoDateSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}
