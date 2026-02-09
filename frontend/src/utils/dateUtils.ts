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
