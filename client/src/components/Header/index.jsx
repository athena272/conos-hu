import "./styles.css";
import "primeicons/primeicons.css";
import logo from "../../assets/images/logo.png";

export default function Header() {
  return (
    <nav className="menu-container">
      <img src={logo} alt="Logo" className="menu-logo" />
    </nav>
  );
}
