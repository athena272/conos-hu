import { useNavigate } from "react-router-dom";
import { Menubar } from "primereact/menubar";
import type { MenuItem } from "primereact/menuitem";
import { clearAuth, sessionCanWriteMedications, sessionCanWithdrawMedications } from "../../auth/session";
import {
  preloadAuthenticatedPage,
  type AuthenticatedPath,
} from "../../routes/lazyAuthenticatedPages";
import "./styles.css";

export default function Menu() {
  const navigate = useNavigate();
  const canWriteMeds = sessionCanWriteMedications();
  const canWithdrawMeds = sessionCanWithdrawMedications();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  /** Navegação client-side: evita reload completo que o Menubar faria com `url`. */
  const navItem = (label: string, icon: string, path: AuthenticatedPath): MenuItem => ({
    label,
    icon,
    command: () => {
      void preloadAuthenticatedPage(path);
      navigate(path);
    },
  });

  const items: MenuItem[] = [
    navItem("Home", "pi pi-home", "/home"),
    {
      label: "Medicamentos",
      icon: "pi pi-tablet",
      items: [
        ...(canWriteMeds
          ? [
              navItem("Registrar", "pi pi-plus-circle", "/register-medication"),
              navItem(
                "Registrar (código de barras)",
                "pi pi-qrcode",
                "/register-medication-barcode",
              ),
            ]
          : []),
        ...(canWithdrawMeds
          ? [navItem("Retirar", "pi pi-cart-arrow-down", "/retira-medication")]
          : []),
        navItem("Simulador", "pi pi-calculator", "/simulador"),
      ],
    },
    {
      label: "Pacientes",
      icon: "pi pi-users",
      items: [
        navItem("Lista de pacientes", "pi pi-users", "/pacientes"),
        navItem("Estoque comprometido", "pi pi-box", "/estoque-comprometido"),
      ],
    },
    {
      label: "Dashboards",
      icon: "pi pi-box",
      items: [
        navItem("Painel de Controle", "pi pi-chart-bar", "/dashboard"),
        navItem("Painel de Estoque", "pi pi-credit-card", "/dashboard-stock"),
      ],
    },
    navItem("Histórico", "pi pi-history", "/historico"),
    {
      label: "Sair",
      icon: "pi pi-sign-out",
      command: handleLogout,
    },
  ];

  return (
    <div className="menu-wrapper" style={{ marginTop: "80px" }}>
      <Menubar model={items} />
    </div>
  );
}
