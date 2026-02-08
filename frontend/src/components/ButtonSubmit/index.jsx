import PropTypes from "prop-types";
import { Button } from "primereact/button";
import "primereact/resources/themes/lara-light-cyan/theme.css";
import "./styles.css";

function ButtonSubmit(props) {
  return (
    <div>
      <Button>{props.children}</Button>
    </div>
  );
}

// Validação de props
ButtonSubmit.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.element,
    PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.element])
    ),
  ]).isRequired,
};

export default ButtonSubmit;
