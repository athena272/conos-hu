import { ReactNode } from "react";
import { Button } from "primereact/button";
import "./styles.scss";

interface ButtonSubmitProps {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  loading?: boolean;
  onClick?: () => void;
}

function ButtonSubmit({
  children,
  disabled = false,
  type = "submit",
  loading = false,
  onClick,
}: ButtonSubmitProps) {
  return (
    <div className="button-submit-wrapper">
      <Button type={type} disabled={disabled || loading} loading={loading} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}

export default ButtonSubmit;
