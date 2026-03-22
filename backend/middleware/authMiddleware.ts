import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../services/authToken";

function extractBearer(header: string | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const t = header.slice(7).trim();
  return t.length > 0 ? t : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }
  next();
}
