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
import RegisterMedicationByBarcode from "./src/pages/RegisterMedicationByBarcode";
import RetiraMedication from "./src/pages/RetiraMedication";
import Simulador from "./src/pages/Simulador";
import Dashboard from "./src/pages/Dashboard";
import DashboardStock from "./src/pages/DashboardStock";
import Pacientes from "./src/pages/Pacientes";
import Historico from "./src/pages/Historico";
import PrivateRoute from "./src/routes/PrivateRoute";
import AdminRoute from "./src/routes/AdminRoute";

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
              <AdminRoute>
                <RegisterMedication />
              </AdminRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/register-medication-barcode"
          element={
            <PrivateRoute>
              <AdminRoute>
                <RegisterMedicationByBarcode />
              </AdminRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/retira-medication"
          element={
            <PrivateRoute>
              <AdminRoute>
                <RetiraMedication />
              </AdminRoute>
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
          path="/pacientes"
          element={
            <PrivateRoute>
              <Pacientes />
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
        <Route
          path="/historico"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Historico />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
