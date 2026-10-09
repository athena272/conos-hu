import { useState } from "react";
import { Field, ErrorMessage } from "formik";
import { InputText } from "primereact/inputtext";
import { FloatLabel } from "primereact/floatlabel";
import { FieldLabel } from "../forms/FieldLabel";
import { requiredFieldMarker } from "../forms/requiredFieldMarker";
import "./styles.css";

interface FloatLabelInputProps {
  name: string;
  /** Rótulo do campo. Se omitido, usa `placeholder` (modo flutuante legado). */
  label?: string;
  /** Texto de exemplo dentro do input (e rótulo legado quando `label` não é passado). */
  placeholder: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  /** Quando false, o rótulo fica fixo acima do campo (sem animação flutuante). */
  floating?: boolean;
}

function FloatLabelInput({
  name,
  label,
  placeholder,
  type = "text",
  autoComplete,
  required = false,
  floating = true,
}: FloatLabelInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const labelText = label ?? placeholder;
  const inputPlaceholder = label ? placeholder : floating ? undefined : placeholder;

  const invalidClass = (form: {
    errors: Record<string, unknown>;
    touched: Record<string, unknown>;
  }) => (form.errors[name] && form.touched[name] ? "p-invalid" : "");

  return (
    <div className="campo-texto">
      <Field name={name}>
        {({
          field,
          form,
        }: {
          field: Record<string, unknown>;
          form: {
            errors: Record<string, unknown>;
            touched: Record<string, unknown>;
          };
        }) => {
          if (!floating) {
            return (
              <div className="input-container">
                <FieldLabel
                  htmlFor={name}
                  label={labelText}
                  required={required}
                />
                {isPassword ? (
                  <div className="float-label-password-wrapper float-label-password-wrapper--static">
                    <InputText
                      id={name}
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder={inputPlaceholder}
                      autoComplete={autoComplete}
                      aria-required={required || undefined}
                      className={`form-field form-field-password ${invalidClass(form)}`}
                    />
                    <button
                      type="button"
                      className={`pi password-toggle ${showPassword ? "pi-eye-slash" : "pi-eye"}`}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                    />
                  </div>
                ) : (
                  <InputText
                    id={name}
                    {...field}
                    type={type}
                    placeholder={inputPlaceholder}
                    autoComplete={autoComplete}
                    aria-required={required || undefined}
                    className={`form-field ${invalidClass(form)}`}
                  />
                )}
              </div>
            );
          }

          return (
            <>
              {isPassword ? (
                <div className="float-label-password-wrapper">
                  <FloatLabel>
                    <InputText
                      id={name}
                      {...field}
                      type={showPassword ? "text" : "password"}
                      autoComplete={autoComplete}
                      aria-required={required || undefined}
                      className={`form-field form-field-password ${invalidClass(form)}`}
                    />
                    <label htmlFor={name}>
                      {labelText}
                      {required ? (
                        <span className="field-required">
                          {requiredFieldMarker(true)}
                        </span>
                      ) : null}
                    </label>
                  </FloatLabel>
                  <button
                    type="button"
                    className={`pi password-toggle ${showPassword ? "pi-eye-slash" : "pi-eye"}`}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  />
                </div>
              ) : (
                <FloatLabel>
                  <InputText
                    id={name}
                    {...field}
                    type={type}
                    autoComplete={autoComplete}
                    aria-required={required || undefined}
                    className={`form-field ${invalidClass(form)}`}
                  />
                  <label htmlFor={name}>
                    {labelText}
                    {required ? (
                      <span className="field-required">
                        {requiredFieldMarker(true)}
                      </span>
                    ) : null}
                  </label>
                </FloatLabel>
              )}
            </>
          );
        }}
      </Field>
      <ErrorMessage component="span" name={name} className="form-error" />
    </div>
  );
}

export default FloatLabelInput;
