import {
  copyrightNotice,
  DEVELOPER_LINKS,
  DEVELOPER_NAME,
  DEVELOPER_ROLE,
} from "../../config/developer";
import "./appFooter.css";

export const DEVELOPER_CONTACT_LABEL = "Contato do desenvolvedor";

/** Tamanho dos ícones de contato (e da área de clique de cada um), em pixels. */
const CONTACT_ICON_SIZE_PX = 32;

type AppFooterProps = {
  className?: string;
};

/** Rodapé comum a todas as telas: crédito de desenvolvimento e contatos do desenvolvedor. */
export function AppFooter({ className }: AppFooterProps) {
  return (
    <footer className={className ? `app-footer ${className}` : "app-footer"}>
      <nav aria-label={DEVELOPER_CONTACT_LABEL}>
        <ul className="app-footer-links">
          {DEVELOPER_LINKS.map(({ label, href, iconClassName, brandColor }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                className="app-footer-link"
                style={{ color: brandColor }}
              >
                <i
                  className={iconClassName}
                  aria-hidden="true"
                  style={{ fontSize: CONTACT_ICON_SIZE_PX }}
                />
                <span className="sr-only">{label} (abre em nova aba)</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="app-footer-text">
        <p className="app-footer-credit">
          Desenvolvido por <strong className="app-footer-name">{DEVELOPER_NAME}</strong>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          <span className="app-footer-role">{DEVELOPER_ROLE}</span>
        </p>
        <p className="app-footer-copyright">{copyrightNotice()}</p>
      </div>
    </footer>
  );
}
