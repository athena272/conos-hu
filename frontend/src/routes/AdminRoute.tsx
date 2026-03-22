import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAdmin, isAuthenticated } from "../auth/session";

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin()) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

export default AdminRoute;
