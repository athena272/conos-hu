import { useState } from "react";
import { Field, ErrorMessage } from "formik";
import { InputText } from "primereact/inputtext";
import { FloatLabel } from "primereact/floatlabel";
import "./styles.css";

interface FloatLabelInputProps {
  name: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}

function FloatLabelInput({
  name,
  placeholder,
  type = "text",
  autoComplete,
}: FloatLabelInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="campo-texto">
      <Field name={name}>
        {({ field, form }: { field: Record<string, unknown>; form: { errors: Record<string, unknown>; touched: Record<string, unknown> } }) => (
          <>
            {isPassword ? (
              <div className="float-label-password-wrapper">
                <FloatLabel>
                  <InputText
                    id={name}
                    {...field}
                    type={showPassword ? "text" : "password"}
                    autoComplete={autoComplete}
                    className={`form-field form-field-password ${form.errors[name] && form.touched[name] ? "p-invalid" : ""}`}
                  />
                  <label htmlFor={name}>{placeholder}</label>
                </FloatLabel>
                <button
                  type="button"
                  className={`pi password-toggle ${showPassword ? "pi-eye-slash" : "pi-eye"}`}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                />
              </div>
            ) : (
              <FloatLabel>
                <InputText
                  id={name}
                  {...field}
                  type={type}
                  autoComplete={autoComplete}
                  className={`form-field ${form.errors[name] && form.touched[name] ? "p-invalid" : ""}`}
                />
                <label htmlFor={name}>{placeholder}</label>
              </FloatLabel>
            )}
          </>
        )}
      </Field>
      <ErrorMessage component="span" name={name} className="form-error" />
    </div>
  );
}

export default FloatLabelInput;
