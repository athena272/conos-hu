import { Field, ErrorMessage } from "formik";
import { Dropdown } from "primereact/dropdown";
import "./styles.css";

export interface DropdownOption {
  name: string;
  code: string | number;
}

interface DropdownInputProps {
  name: string;
  label: string;
  options: DropdownOption[];
}

function DropdownInput({ name, label, options }: DropdownInputProps) {
  return (
    <div className="campo-dropdown">
      <Field name={name}>
        {({ field, form }: { field: { value: unknown }; form: { setFieldValue: (name: string, value: unknown) => void; setFieldTouched: (name: string, touched: boolean) => void; errors: Record<string, unknown>; touched: Record<string, unknown> } }) => (
          <div className="input-container">
            <label htmlFor={name} className="input-label">{label}</label>
            <Dropdown
              id={name}
              value={field.value}
              onChange={(e: { value: unknown }) => form.setFieldValue(name, e.value)}
              onBlur={() => form.setFieldTouched(name, true)}
              options={options}
              optionLabel="name"
              placeholder={`Selecione ${label}`}
              className={`w-full md:w-14rem ${form.errors[name] && form.touched[name] ? "p-invalid" : ""}`}
            />
          </div>
        )}
      </Field>
      <ErrorMessage component="span" name={name} className="form-error" />
    </div>
  );
}

export default DropdownInput;
