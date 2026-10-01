import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  copyrightNotice,
  DEVELOPER_LINKS,
  DEVELOPER_NAME,
  DEVELOPER_ROLE,
} from "../../config/developer";
import { AppFooter, DEVELOPER_CONTACT_LABEL } from "./AppFooter";

/** Cada `<a>…</a>` do HTML, com a tag de abertura separada do conteúdo. */
function extractLinks(html: string) {
  return [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map(([, attrs, content]) => ({
    attrs,
    content,
  }));
}

describe("AppFooter", () => {
  it("credita o desenvolvedor com nome em destaque, cargo e aviso de direitos", () => {
    const html = renderToStaticMarkup(<AppFooter />);

    expect(html).toContain(`<strong class="app-footer-name">${DEVELOPER_NAME}</strong>`);
    expect(html).toContain(`<span class="app-footer-role">${DEVELOPER_ROLE}</span>`);
    expect(html).toContain(copyrightNotice());
  });

  it("esconde o separador dos leitores de tela e anuncia uma vírgula no lugar", () => {
    const html = renderToStaticMarkup(<AppFooter />);

    expect(html).toContain('<span aria-hidden="true"> · </span><span class="sr-only">, </span>');
  });

  it("agrupa os contatos em uma navegação rotulada", () => {
    const html = renderToStaticMarkup(<AppFooter />);

    expect(html).toContain(`<nav aria-label="${DEVELOPER_CONTACT_LABEL}">`);
    expect(extractLinks(html)).toHaveLength(DEVELOPER_LINKS.length);
  });

  it("abre cada contato em nova aba com segurança e nome acessível", () => {
    const links = extractLinks(renderToStaticMarkup(<AppFooter />));

    DEVELOPER_LINKS.forEach(({ label, href, iconClassName, brandColor }, index) => {
      const { attrs, content } = links[index];
      expect(attrs).toContain(`href="${href}"`);
      expect(attrs).toContain('target="_blank"');
      expect(attrs).toContain('rel="noopener noreferrer"');
      expect(attrs).toContain(`color:${brandColor}`);
      expect(content).toContain(`<i class="${iconClassName}" aria-hidden="true"`);
      expect(content).toContain(`<span class="sr-only">${label} (abre em nova aba)</span>`);
    });
  });

  it("usa ícones de 32px", () => {
    const html = renderToStaticMarkup(<AppFooter />);

    expect(html.match(/font-size:32px/g)).toHaveLength(DEVELOPER_LINKS.length);
  });

  it("aceita className para ajustes de cada layout", () => {
    expect(renderToStaticMarkup(<AppFooter />)).toContain('<footer class="app-footer">');
    expect(renderToStaticMarkup(<AppFooter className="extra" />)).toContain(
      '<footer class="app-footer extra">',
    );
  });
});
