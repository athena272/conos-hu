import { Link } from "react-router-dom";
import notFoundImage from "../../assets/images/404.png";
import "./styles.css";

function NotFound() {
  return (
    <div className="container-primary-not-found">
      <div className="not-found-title">
        <h1>404</h1>
        <h2>Página não encontrada!</h2>
        <p>Não conseguimos encontrar a página que você está buscando.</p>
        <Link to="/login" className="not-found-link">
          Voltar ao início
        </Link>
      </div>

      <div className="not-found-container">
        <img src={notFoundImage} alt="Página não encontrada" id="not-found-image" />
      </div>
    </div>
  );
}

export default NotFound;
