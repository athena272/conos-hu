import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import OperatorIdentifyGate from "../components/OperatorIdentifyGate";
import { isAuthenticated } from "../auth/session";

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <OperatorIdentifyGate>{children}</OperatorIdentifyGate>;
};

export default PrivateRoute;
