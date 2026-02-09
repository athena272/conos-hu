import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";

import Login from "./src/pages/Login";
import Register from "./src/pages/Register";
import Home from "./src/pages/Home";
import NotFound from "./src/pages/NotFound";
import RegisterMedication from "./src/pages/RegisterMedication";
import RetiraMedication from "./src/pages/RetiraMedication";
import Simulador from "./src/pages/Simulador";
import Dashboard from "./src/pages/Dashboard";
import DashboardStock from "./src/pages/DashboardStock";
import PrivateRoute from "./src/routes/PrivateRoute";

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ROTAS PRIVADAS */}
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/register-medication"
          element={
            <PrivateRoute>
              <RegisterMedication />
            </PrivateRoute>
          }
        />
        <Route
          path="/retira-medication"
          element={
            <PrivateRoute>
              <RetiraMedication />
            </PrivateRoute>
          }
        />
        <Route
          path="/simulador"
          element={
            <PrivateRoute>
              <Simulador />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard-stock"
          element={
            <PrivateRoute>
              <DashboardStock />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
