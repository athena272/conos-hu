import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, sessionIsElevated } from "../auth/session";

interface ElevatedRouteProps {
  children: ReactNode;
}

/** Papéis elevados: admin completo e admins especializados (Histórico, leitura plena). */
const ElevatedRoute = ({ children }: ElevatedRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!sessionIsElevated()) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

export default ElevatedRoute;
