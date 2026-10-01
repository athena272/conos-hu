import { Outlet } from "react-router-dom";
import { AppFooter } from "./AppFooter";
import "./authenticatedLayout.css";

/** Envolve as telas autenticadas e mantém o rodapé fixo na parte inferior da janela. */
export function AuthenticatedLayout() {
  return (
    <div className="authenticated-layout">
      <div className="authenticated-layout-content">
        <Outlet />
      </div>
      <AppFooter className="authenticated-layout-footer" />
    </div>
  );
}
