/**
 * Formata string de data (YYYY-MM-DD ou ISO) para dd/MM/yyyy
 * sem conversão de fuso — evita bug de exibir um dia a menos.
 */
export function formatDateBR(dateString: string): string {
  const datePart = String(dateString).trim().split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return dateString;
}

/**
 * Extrai YYYY-MM-DD para uso em input type="date"
 */
export function toInputDateValue(dateString: string): string {
  const datePart = String(dateString).trim().split("T")[0];
  return datePart || "";
}

/**
 * Converte dd/MM/yyyy em YYYY-MM-DD se for data válida no calendário.
 */
export function parseDateBRToISODate(br: string): string | null {
  const s = String(br).trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** dd/mm/aaaa válido → `Date` em horário local (meia-noite). */
export function parseDateBRToLocalDate(br: string): Date | null {
  const iso = parseDateBRToISODate(br);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

/** `Date` em horário local → dd/mm/aaaa (para máscara / filtro). */
export function localDateToDateBR(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD válido no calendário → Date local à meia-noite; senão null. */
export function parseIsoDateToLocalDate(iso: string): Date | null {
  const s = toInputDateValue(iso);
  if (!ISO_DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

/**
 * Diferença em dias civis (fim − início), sem conversão de fuso.
 * Retorna null se alguma data for inválida ou se fim < início.
 */
export function daysBetweenIsoDates(
  inicioISO: string,
  fimISO: string,
): number | null {
  const inicio = parseIsoDateToLocalDate(inicioISO);
  const fim = parseIsoDateToLocalDate(fimISO);
  if (!inicio || !fim) return null;
  const ms = fim.getTime() - inicio.getTime();
  if (ms < 0) return null;
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * No edit, só envia data_retorno se o usuário alterou em relação à próxima
 * já conhecida — evita inserir retorno duplicado ao salvar sem mudança.
 */
export function shouldSendDataRetornoOnEdit(
  formDataRetorno: string | null | undefined,
  proximaDataRetornoInicial: string | null | undefined,
): boolean {
  const formIso = toInputDateValue(String(formDataRetorno ?? "").trim());
  if (!formIso || !ISO_DATE_RE.test(formIso)) return false;
  const proximaIso = proximaDataRetornoInicial
    ? toInputDateValue(proximaDataRetornoInicial)
    : "";
  if (!proximaIso) return true;
  return formIso !== proximaIso;
}
