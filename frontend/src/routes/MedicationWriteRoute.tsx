import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, sessionCanWriteMedications } from "../auth/session";

interface MedicationWriteRouteProps {
  children: ReactNode;
}

const MedicationWriteRoute = ({ children }: MedicationWriteRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!sessionCanWriteMedications()) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

export default MedicationWriteRoute;
