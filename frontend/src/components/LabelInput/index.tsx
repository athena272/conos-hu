import { Field, ErrorMessage } from "formik";
import { InputText } from "primereact/inputtext";
import { FieldLabel } from "../forms/FieldLabel";
import "./styles.css";

interface LabelInputProps {
  name: string;
  /** Texto exibido acima do campo (rótulo) */
  label: string;
  /** Texto de exemplo dentro do campo quando vazio */
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}

function LabelInput({
  name,
  label,
  placeholder = "",
  type = "text",
  disabled = false,
  required = false,
}: LabelInputProps) {
  return (
    <div className="campo-texto">
      <Field name={name}>
        {({ field, form }: { field: Record<string, unknown>; form: { errors: Record<string, unknown>; touched: Record<string, unknown> } }) => (
          <div className="input-container">
            <FieldLabel htmlFor={name} label={label} required={required} />
            <InputText
              id={name}
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              aria-describedby={`${name}-help`}
              aria-required={required || undefined}
              className={`form-field ${form.errors[name] && form.touched[name] ? "p-invalid" : ""}`}
            />
          </div>
        )}
      </Field>
      <ErrorMessage component="span" name={name} className="form-error" />
    </div>
  );
}

export default LabelInput;
