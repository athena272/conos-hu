import { Suspense, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import FullScreenLoader from "../FullScreenLoader";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

export const ROUTE_LOADING_MESSAGE = "Carregando tela...";

interface LazyRouteBoundaryProps {
  children: ReactNode;
}

/**
 * Envolve telas carregadas sob demanda (`React.lazy`): mostra o loader enquanto o arquivo
 * da tela é baixado e um aviso com opção de recarregar se ele não carregar.
 */
export function LazyRouteBoundary({ children }: LazyRouteBoundaryProps) {
  const { pathname } = useLocation();

  return (
    <RouteErrorBoundary key={pathname}>
      <Suspense fallback={<FullScreenLoader active message={ROUTE_LOADING_MESSAGE} />}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}
