import { ReactNode } from "react";
import { Button } from "primereact/button";
import "primereact/resources/themes/lara-light-cyan/theme.css";
import "./styles.css";

interface ButtonSubmitProps {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

function ButtonSubmit({
  children,
  disabled = false,
  type = "submit",
}: ButtonSubmitProps) {
  return (
    <div>
      <Button type={type} disabled={disabled}>
        {children}
      </Button>
    </div>
  );
}

export default ButtonSubmit;
