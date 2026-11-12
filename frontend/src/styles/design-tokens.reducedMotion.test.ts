import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "design-tokens.css");

/** Extrai o corpo do primeiro `@media (prefers-reduced-motion: reduce)`. */
function extractReducedMotionBlock(css: string): string | null {
  const marker = "@media (prefers-reduced-motion: reduce)";
  const start = css.indexOf(marker);
  if (start === -1) return null;

  const openBrace = css.indexOf("{", start);
  if (openBrace === -1) return null;

  let depth = 0;
  for (let i = openBrace; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openBrace + 1, i);
      }
    }
  }

  return null;
}

describe("design-tokens prefers-reduced-motion", () => {
  const css = readFileSync(cssPath, "utf8");
  const block = extractReducedMotionBlock(css);

  it("define um bloco prefers-reduced-motion: reduce", () => {
    expect(block).not.toBeNull();
  });

  it("reduz transition-duration sem zerar animation-duration (spinners infinitos)", () => {
    expect(block).toMatch(/transition-duration\s*:/);
    expect(block).not.toMatch(/animation-duration\s*:/);
  });
});
