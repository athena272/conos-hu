import PropTypes from "prop-types";
import { Field, ErrorMessage } from "formik";
import { InputText } from "primereact/inputtext";
import { FloatLabel } from "primereact/floatlabel";
import "./styles.css";

function FloatLabelInput({ name, placeholder, type = "text" }) {
  return (
    <div className="campo-texto">
      <Field name={name}>
        {({ field, form }) => (
          <FloatLabel>
            <InputText
              id={name}
              {...field}
              type={type}
              className={`form-field ${form.errors[name] && form.touched[name] ? "p-invalid" : ""}`}
            />
            <label htmlFor={name}>{placeholder}</label>
          </FloatLabel>
        )}
      </Field>
      <ErrorMessage component="span" name={name} className="form-error" />
    </div>
  );
}

// Validação de props
FloatLabelInput.propTypes = {
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  type: PropTypes.string,
};

// Valores padrão para props opcionais
FloatLabelInput.defaultProps = {
  type: "text",
};

export default FloatLabelInput;