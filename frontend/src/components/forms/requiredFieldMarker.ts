/** Visible suffix appended to required field labels (matches optional “(opcional)” style). */
export function requiredFieldMarker(required?: boolean): string | null {
  return required ? " (obrigatório)" : null;
}
