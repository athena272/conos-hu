import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

const isAuthenticated = (): boolean => {
  return !!localStorage.getItem("userId");
};

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
