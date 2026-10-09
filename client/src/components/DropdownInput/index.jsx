import PropTypes from "prop-types";
import { Field, ErrorMessage } from "formik";
import { Dropdown } from "primereact/dropdown";
import "./styles.css";

function DropdownInput({ name, label, options }) {
  return (
    <div className="campo-dropdown">
      <Field name={name}>
        {({ field, form }) => (
          <div className="input-container">
            <label htmlFor={name} className="input-label">{label}</label>
            <Dropdown
              id={name}
              value={field.value}
              onChange={(e) => form.setFieldValue(name, e.value)}
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

DropdownInput.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      code: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ).isRequired,
};

export default DropdownInput;