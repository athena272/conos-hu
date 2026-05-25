import { ProgressSpinner } from "primereact/progressspinner";
import "./styles.scss";

interface InlineLoaderProps {
  message?: string;
  className?: string;
}

function InlineLoader({
  message = "Carregando...",
  className = "",
}: InlineLoaderProps) {
  return (
    <div
      className={`inline-loader ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <ProgressSpinner
        style={{ width: "48px", height: "48px" }}
        strokeWidth="3"
      />
      {message && <p className="inline-loader__message">{message}</p>}
    </div>
  );
}

export default InlineLoader;
