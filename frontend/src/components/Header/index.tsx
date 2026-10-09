import { BrandMark } from "../brand/BrandMark";
import "./styles.css";

export default function Header() {
  return (
    <nav className="menu-container" aria-label="Marca Conos">
      <BrandMark size="md" subtitle="Controle de medicamentos" />
    </nav>
  );
}
