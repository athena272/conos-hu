import { lazy } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";

import Login from "./src/pages/Login";
import Register from "./src/pages/Register";
import NotFound from "./src/pages/NotFound";
import PrivateRoute from "./src/routes/PrivateRoute";
import MedicationWriteRoute from "./src/routes/MedicationWriteRoute";
import { AuthLayout } from "./src/components/layout/AuthLayout";
import { AuthenticatedLayout } from "./src/components/layout/AuthenticatedLayout";
import { lazyAuthenticatedPages } from "./src/routes/lazyAuthenticatedPages";

/**
 * Telas autenticadas saem em arquivos próprios, baixados só na primeira visita à rota.
 * Precisam ficar sob o `AuthenticatedLayout`, que fornece o Suspense e o tratamento de erro.
 */
const Home = lazy(lazyAuthenticatedPages["/home"]);
const RegisterMedication = lazy(lazyAuthenticatedPages["/register-medication"]);
const RegisterMedicationByBarcode = lazy(lazyAuthenticatedPages["/register-medication-barcode"]);
const RetiraMedication = lazy(lazyAuthenticatedPages["/retira-medication"]);
const Simulador = lazy(lazyAuthenticatedPages["/simulador"]);
const Dashboard = lazy(lazyAuthenticatedPages["/dashboard"]);
const DashboardStock = lazy(lazyAuthenticatedPages["/dashboard-stock"]);
const Pacientes = lazy(lazyAuthenticatedPages["/pacientes"]);
const EstoqueComprometido = lazy(lazyAuthenticatedPages["/estoque-comprometido"]);
const Historico = lazy(lazyAuthenticatedPages["/historico"]);

/** Árvore de rotas, sem o roteador, para poder ser montada também com `MemoryRouter` nos testes. */
export const AppRouteTree = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ROTAS PÚBLICAS DE AUTENTICAÇÃO */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* ROTAS PRIVADAS */}
      <Route element={<AuthenticatedLayout />}>
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
              <MedicationWriteRoute>
                <RegisterMedication />
              </MedicationWriteRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/register-medication-barcode"
          element={
            <PrivateRoute>
              <MedicationWriteRoute>
                <RegisterMedicationByBarcode />
              </MedicationWriteRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/retira-medication"
          element={
            <PrivateRoute>
              <MedicationWriteRoute>
                <RetiraMedication />
              </MedicationWriteRoute>
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
          path="/estoque-comprometido"
          element={
            <PrivateRoute>
              <EstoqueComprometido />
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
              <Historico />
            </PrivateRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppRoutes = () => {
  return (
    <Router>
      <AppRouteTree />
    </Router>
  );
};

export default AppRoutes;
