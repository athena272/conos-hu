import { Component, type ErrorInfo, type ReactNode } from "react";
import { RouteLoadError } from "./RouteLoadError";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

/**
 * Evita a tela em branco quando uma tela falha ao abrir, por exemplo quando o arquivo dela
 * não existe mais porque uma nova versão foi publicada com a aba ainda aberta.
 * Use com `key` da rota para que trocar de tela limpe o erro.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Falha ao abrir a tela:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <RouteLoadError />;
    }
    return this.props.children;
  }
}
