import type { Request } from "express";

/** IP do cliente (proxy-aware quando trust proxy está ativo). */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  const ip = req.ip ?? req.socket?.remoteAddress;
  if (!ip || typeof ip !== "string") return null;
  const normalized = ip.replace(/^::ffff:/, "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function getUserAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  if (typeof ua !== "string" || !ua.trim()) return null;
  return ua.trim().slice(0, 512);
}
