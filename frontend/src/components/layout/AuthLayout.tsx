import { Outlet } from "react-router-dom";
import authHero from "../../assets/images/auth-hero.png";
import { BrandMark } from "../brand/BrandMark";
import { AppFooter } from "./AppFooter";
import "./authLayout.css";

/** Tela dividida das páginas públicas de autenticação (login e cadastro): imagem de marca e formulário. */
export function AuthLayout() {
  return (
    <div className="container-primary">
      <div className="container-secundary-one auth-hero">
        <img src={authHero} alt="" className="auth-hero-image" />
        <div className="auth-hero-overlay">
          <BrandMark tone="onDark" subtitle="Estoque e pacientes" />
          <p className="auth-hero-lead">
            Controle de medicamentos, lotes e pacientes em um só lugar.
          </p>
        </div>
      </div>
      <div className="container-secundary-two">
        <div className="auth-layout-content">
          <Outlet />
        </div>
        <AppFooter className="auth-layout-footer" />
      </div>
    </div>
  );
}
