import { Navigate } from "react-router-dom";

const isAuthenticated = () => {
  return !!localStorage.getItem("userId");
};

const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;