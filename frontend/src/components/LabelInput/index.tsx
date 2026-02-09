import { Field, ErrorMessage } from "formik";
import { InputText } from "primereact/inputtext";
import "./styles.css";

interface LabelInputProps {
  name: string;
  placeholder: string;
  type?: string;
  disabled?: boolean;
}

function LabelInput({
  name,
  placeholder,
  type = "text",
  disabled = false,
}: LabelInputProps) {
  return (
    <div className="campo-texto">
      <Field name={name}>
        {({ field, form }: { field: Record<string, unknown>; form: { errors: Record<string, unknown>; touched: Record<string, unknown> } }) => (
          <div className="input-container">
            <label htmlFor={name} className="input-label">{placeholder}</label>
            <InputText
              id={name}
              {...field}
              type={type}
              disabled={disabled}
              aria-describedby={`${name}-help`}
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
