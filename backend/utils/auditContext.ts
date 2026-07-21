import type { Request } from "express";
import { recordEvent, type RecordEventInput } from "../services/eventService";
import { getClientIp } from "./requestContext";

export function buildAuditDetalhes(
  req: Request,
  base?: Record<string, unknown>,
): Record<string, unknown> {
  const detalhes: Record<string, unknown> = { ...(base ?? {}) };
  const operador = req.user?.operador_nome?.trim();
  if (operador) detalhes.operador_nome = operador;
  const ip = getClientIp(req);
  if (ip) detalhes.ip = ip;
  return detalhes;
}

export async function recordEventFromRequest(
  req: Request,
  input: Omit<RecordEventInput, "usuario_id" | "detalhes"> & {
    detalhes?: Record<string, unknown>;
  },
): Promise<void> {
  if (!req.user) return;
  await recordEvent({
    ...input,
    usuario_id: req.user.id,
    detalhes: buildAuditDetalhes(req, input.detalhes),
  });
}
