import { useNavigate } from "react-router-dom";
import { Menubar } from "primereact/menubar";
import "./styles.css";

export default function Menu() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("userId");
    navigate("/login");
  };

  const items = [
    {
      label: "Home",
      icon: "pi pi-home",
      url: "/home",
    },
    {
      label: "Medicações",
      icon: "pi pi-tablet",
      items: [
        {
          label: "Registrar",
          icon: "pi pi-plus-circle",
          url: "/register-medication",
        },
        {
          label: "Retirar",
          icon: "pi pi-cart-arrow-down",
          url: "/retira-medication",
        },
      ],
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
