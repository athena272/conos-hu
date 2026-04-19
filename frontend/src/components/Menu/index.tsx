import { useNavigate } from "react-router-dom";
import { Menubar } from "primereact/menubar";
import { clearAuth, isAdmin } from "../../auth/session";
import "./styles.css";

export default function Menu() {
  const navigate = useNavigate();
  const admin = isAdmin();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const items = [
    {
      label: "Home",
      icon: "pi pi-home",
      url: "/home",
    },
    {
      label: "Medicamentos",
      icon: "pi pi-tablet",
      items: [
        ...(admin
          ? [
              {
                label: "Registrar",
                icon: "pi pi-plus-circle",
                url: "/register-medication",
              },
              {
                label: "Registrar (código de barras)",
                icon: "pi pi-qrcode",
                url: "/register-medication-barcode",
              },
              {
                label: "Retirar",
                icon: "pi pi-cart-arrow-down",
                url: "/retira-medication",
              },
            ]
          : []),
        {
          label: "Simulador",
          icon: "pi pi-calculator",
          url: "/simulador",
        },
      ],
    },
    {
      label: "Pacientes",
      icon: "pi pi-users",
      url: "/pacientes",
    },
    {
      label: "Dashboards",
      icon: "pi pi-box",
      items: [
        {
          label: "Painel de Controle",
          icon: "pi pi-chart-bar",
          url: "/dashboard",
        },
        {
          label: "Painel de Estoque",
          icon: "pi pi-credit-card",
          url: "/dashboard-stock",
        },
      ],
    },
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
