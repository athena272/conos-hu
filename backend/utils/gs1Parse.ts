/**
 * Extrai dados úteis de strings GS1 (parênteses ou fluxo numérico) e GTIN solto.
 * Não cobre todos os AIs; foco em (01) GTIN, (17) validade, (10) lote, (21) serial.
 */

const GS1_FNC1 = String.fromCharCode(29);

export interface Gs1Extracted {
  gtin?: string;
  lote?: string;
  serial?: string;
  /** YYYY-MM-DD */
  data_validade?: string;
}

function yyMmDdToIso(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

/** Normaliza para 14 dígitos (GTIN-14) quando possível. */
export function normalizeGtinDigits(digits: string): string | undefined {
  const d = digits.replace(/\D/g, "");
  if (d.length === 14) return d;
  if (d.length === 13) return `0${d}`;
  if (d.length === 12) return `00${d}`;
  if (d.length === 8) return `000000${d}`;
  return undefined;
}

/** Tenta obter GTIN a partir só de dígitos (EAN-13, GTIN-14 no fim da string, etc.). */
export function extractGtinFromDigitString(digits: string): string | undefined {
  const d = digits.replace(/\D/g, "");
  if (d.length === 0) return undefined;
  if (d.length <= 14) return normalizeGtinDigits(d);
  return normalizeGtinDigits(d.slice(-14)) ?? normalizeGtinDigits(d.slice(-13));
}

/**
 * Formato com parênteses: (01)00789123456789(17)241231(10)ABC123
 */
function parseParenthesized(raw: string): Gs1Extracted {
  const out: Gs1Extracted = {};
  const re = /\((\d{2})\)([^(]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const ai = m[1];
    let content = m[2].trim();
    if (content.endsWith(GS1_FNC1)) content = content.slice(0, -1);

    if (ai === "01" && /^\d{14}$/.test(content)) {
      out.gtin = content;
    } else if (ai === "17" && /^\d{6}$/.test(content)) {
      const iso = yyMmDdToIso(content);
      if (iso) out.data_validade = iso;
    } else if (ai === "10" && content.length > 0) {
      out.lote = content;
    } else if (ai === "21" && content.length > 0) {
      out.serial = content;
    }
  }
  return out;
}

/**
 * Fluxo sem parênteses (ex.: alguns leitores GS1-128).
 * Percorre a partir do início com AIs conhecidos.
 */
function parseDigitStreamWithoutParens(digits: string): Gs1Extracted {
  const out: Gs1Extracted = {};
  let i = 0;
  const d = digits.replace(/\D/g, "");

  while (i < d.length) {
    const two = d.slice(i, i + 2);
    if (two === "01" && d.length >= i + 2 + 14) {
      const g = d.slice(i + 2, i + 16);
      if (/^\d{14}$/.test(g)) {
        out.gtin = g;
        i += 16;
        continue;
      }
    }
    if (two === "17" && d.length >= i + 2 + 6) {
      const exp = d.slice(i + 2, i + 8);
      if (/^\d{6}$/.test(exp)) {
        const iso = yyMmDdToIso(exp);
        if (iso) out.data_validade = iso;
        i += 8;
        continue;
      }
    }
    if (two === "10") {
      i += 2;
      let end = i;
      while (end < d.length) {
        const next2 = d.slice(end, end + 2);
        if (["01", "17", "21", "11", "13", "15"].includes(next2) && end > i) break;
        end++;
      }
      const lot = d.slice(i, end).replace(/[^A-Za-z0-9\-_.]/g, "") || d.slice(i, Math.min(i + 20, d.length));
      if (lot) out.lote = lot;
      i = end;
      continue;
    }
    if (two === "21" && d.length > i + 2) {
      i += 2;
      let end = i;
      while (end < d.length) {
        const next2 = d.slice(end, end + 2);
        if (["01", "17", "10"].includes(next2) && end > i) break;
        end++;
      }
      const ser = d.slice(i, end);
      if (ser) out.serial = ser;
      i = end;
      continue;
    }
    i += 1;
  }

  return out;
}

export function parseGs1Raw(raw: string): Gs1Extracted {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (trimmed.includes("(")) {
    return parseParenthesized(trimmed);
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 16 && digitsOnly.startsWith("01")) {
    const stream = parseDigitStreamWithoutParens(trimmed);
    if (Object.keys(stream).length > 0) return stream;
  }

  if (/^\d{8,14}$/.test(digitsOnly)) {
    const gtin = extractGtinFromDigitString(digitsOnly);
    return gtin ? { gtin } : {};
  }

  const stream = parseDigitStreamWithoutParens(trimmed);
  if (Object.keys(stream).length > 0) return stream;

  const gtin = extractGtinFromDigitString(digitsOnly);
  return gtin ? { gtin } : {};
}
