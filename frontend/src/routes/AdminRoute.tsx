import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, sessionIsElevated } from "../auth/session";

interface AdminRouteProps {
  children: ReactNode;
}

/** @deprecated Prefer ElevatedRoute — alias para papéis elevados. */
const AdminRoute = ({ children }: AdminRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!sessionIsElevated()) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

export default AdminRoute;
