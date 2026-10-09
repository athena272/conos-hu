import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../services/authToken";
import {
  canWriteMedications,
  canWritePacientes,
  canWithdrawMedications,
  isElevated,
} from "../utils/permissions";

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
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      operador_nome: payload.operador_nome,
    };
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function requireElevated(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  if (!isElevated(req.user.role)) {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }
  next();
}

/** Alias legado — equivale a requireElevated (leituras/ações administrativas). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireElevated(req, res, next);
}

export function requireMedicationWrite(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  if (!canWriteMedications(req.user.role)) {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }
  next();
}

export function requireMedicationWithdraw(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  if (!canWithdrawMedications(req.user.role)) {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }
  next();
}

export function requirePacienteWrite(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  if (!canWritePacientes(req.user.role)) {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }
  next();
}
