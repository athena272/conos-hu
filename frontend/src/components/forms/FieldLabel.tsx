import { requiredFieldMarker } from "./requiredFieldMarker";

type FieldLabelProps = {
  htmlFor?: string;
  label: string;
  required?: boolean;
  className?: string;
};

/** Shared label with optional “(obrigatório)” marker for ad-hoc form fields. */
export function FieldLabel({
  htmlFor,
  label,
  required,
  className = "input-label",
}: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={className}>
      {label}
      {required ? (
        <span className="field-required">{requiredFieldMarker(true)}</span>
      ) : null}
    </label>
  );
}
