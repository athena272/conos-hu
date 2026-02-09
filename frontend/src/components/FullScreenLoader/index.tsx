import { ProgressSpinner } from "primereact/progressspinner";
import "./styles.scss";

interface FullScreenLoaderProps {
  /** Quando true, exibe o overlay e o spinner em tela cheia */
  active: boolean;
  /** Texto opcional exibido abaixo do spinner (ex.: "Entrando...") */
  message?: string;
}

function FullScreenLoader({ active, message }: FullScreenLoaderProps) {
  if (!active) return null;

  return (
    <div
      className="full-screen-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? "Carregando"}
    >
      <div className="full-screen-loader__content">
        <ProgressSpinner
          style={{ width: "56px", height: "56px" }}
          strokeWidth="3"
        />
        {message && (
          <p className="full-screen-loader__message">{message}</p>
        )}
      </div>
    </div>
  );
}

export default FullScreenLoader;
