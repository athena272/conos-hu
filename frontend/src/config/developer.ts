/**
 * Dados do desenvolvedor exibidos no rodapé de todas as telas.
 * Concentrados aqui para não haver strings soltas nos componentes.
 */
export const DEVELOPER_NAME = "Guilherme R. Alves";
export const DEVELOPER_ROLE = "Engenheiro de Software";

/** (79) 99900-7075, com o DDI do Brasil exigido pelo `wa.me`. */
const DEVELOPER_WHATSAPP = "+55 (79) 99900-7075";

export interface DeveloperLink {
  label: string;
  href: string;
  /** Classes do PrimeIcons (`pi pi-*`). */
  iconClassName: string;
  /** Cor oficial da marca; o GitHub usa a cor do texto principal para funcionar em qualquer tema. */
  brandColor: string;
}

/** Link de conversa do WhatsApp; o `wa.me` só aceita dígitos (DDI + DDD + número). */
export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function copyrightNotice(year: number = new Date().getFullYear()): string {
  return `© ${year} Todos os direitos reservados.`;
}

export const DEVELOPER_LINKS: readonly DeveloperLink[] = [
  {
    label: "WhatsApp",
    href: whatsappUrl(DEVELOPER_WHATSAPP),
    iconClassName: "pi pi-whatsapp",
    brandColor: "#25D366",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/guigorosario/",
    iconClassName: "pi pi-linkedin",
    brandColor: "#0A66C2",
  },
  {
    label: "GitHub",
    href: "https://github.com/athena272",
    iconClassName: "pi pi-github",
    brandColor: "var(--ink)",
  },
];
