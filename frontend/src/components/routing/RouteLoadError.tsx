import { Button } from "primereact/button";
import { reloadPage } from "../../utils/reloadPage";
import "./routeLoadError.css";

/** Aviso exibido no lugar de uma tela que não conseguiu abrir (ex.: arquivo removido por um novo deploy). */
export function RouteLoadError() {
  return (
    <div className="route-load-error" role="alert">
      <h2 className="route-load-error-title">Não foi possível abrir esta tela.</h2>
      <p className="route-load-error-description">
        Uma nova versão do sistema pode ter sido publicada ou a conexão falhou. Recarregue a página.
      </p>
      <Button label="Recarregar página" icon="pi pi-refresh" onClick={reloadPage} />
    </div>
  );
}
