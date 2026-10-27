import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { preloadAuthenticatedPage } from "../../routes/lazyAuthenticatedPages";
import { LazyRouteBoundary } from "../routing/LazyRouteBoundary";
import { AppFooter } from "./AppFooter";
import "./authenticatedLayout.css";

/** Envolve as telas autenticadas e mantém o rodapé fixo na parte inferior da janela. */
export function AuthenticatedLayout() {
  useEffect(() => {
    void preloadAuthenticatedPage("/home");
  }, []);

  return (
    <div className="authenticated-layout">
      <div className="authenticated-layout-content">
        <LazyRouteBoundary>
          <Outlet />
        </LazyRouteBoundary>
      </div>
      <AppFooter className="authenticated-layout-footer" />
    </div>
  );
}
