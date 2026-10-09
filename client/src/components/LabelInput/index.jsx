import PropTypes from "prop-types";
import { Field, ErrorMessage } from "formik";
import { InputText } from "primereact/inputtext";
import "./styles.css";

function LabelInput({ name, placeholder, type = "text" }) {
  return (
    <div className="campo-texto">
      <Field name={name}>
        {({ field, form }) => (
          <div className="input-container">
            <label htmlFor={name} className="input-label">{placeholder}</label>
            <InputText
              id={name}
              {...field}
              type={type}
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

LabelInput.propTypes = {
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  type: PropTypes.string,
};

LabelInput.defaultProps = {
  type: "text",
};

export default LabelInput;
