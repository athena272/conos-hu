import type { Request, Response } from "express";
import { coll } from "../models/mongo";
import { formatMysqlTimestamp } from "../models/mappers";
import type { EventoDoc, EventoListItem } from "../types/evento";
import { isEventoAcao, isEventoEntidade } from "../types/evento";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnlyParam(raw: unknown, field: string): { ok: true; value: string } | { ok: false; error: string } {
  if (raw == null || String(raw).trim() === "") {
    return { ok: true, value: "" };
  }
  const value = String(raw).trim();
  if (!DATE_ONLY_RE.test(value)) {
    return { ok: false, error: `${field} deve estar no formato YYYY-MM-DD` };
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `${field} inválido` };
  }
  return { ok: true, value };
}

export const listEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ignore nested query objects (e.g. acao[label]=...) from malformed clients
    if (typeof req.query.acao === "object" && req.query.acao !== null) {
      res.status(400).json({ error: "acao inválida" });
      return;
    }
    if (typeof req.query.entidade_tipo === "object" && req.query.entidade_tipo !== null) {
      res.status(400).json({ error: "entidade_tipo inválido" });
      return;
    }

    const filter: Record<string, unknown> = {};

    if (req.query.acao != null && String(req.query.acao).trim() !== "") {
      const acao = String(req.query.acao).trim();
      if (!isEventoAcao(acao)) {
        res.status(400).json({ error: "acao inválida" });
        return;
      }
      filter.acao = acao;
    }

    if (req.query.entidade_tipo != null && String(req.query.entidade_tipo).trim() !== "") {
      const entidade_tipo = String(req.query.entidade_tipo).trim();
      if (!isEventoEntidade(entidade_tipo)) {
        res.status(400).json({ error: "entidade_tipo inválido" });
        return;
      }
      filter.entidade_tipo = entidade_tipo;
    }

    if (req.query.usuario_id != null && String(req.query.usuario_id).trim() !== "") {
      const usuario_id = parseInt(String(req.query.usuario_id), 10);
      if (isNaN(usuario_id) || usuario_id < 1) {
        res.status(400).json({ error: "usuario_id inválido" });
        return;
      }
      filter.usuario_id = usuario_id;
    }

    const inicioParsed = parseDateOnlyParam(req.query.data_inicio, "data_inicio");
    if (!inicioParsed.ok) {
      res.status(400).json({ error: inicioParsed.error });
      return;
    }
    const fimParsed = parseDateOnlyParam(req.query.data_fim, "data_fim");
    if (!fimParsed.ok) {
      res.status(400).json({ error: fimParsed.error });
      return;
    }

    if (inicioParsed.value || fimParsed.value) {
      const createdAt: Record<string, Date> = {};
      if (inicioParsed.value) {
        createdAt.$gte = new Date(`${inicioParsed.value}T00:00:00.000Z`);
      }
      if (fimParsed.value) {
        createdAt.$lte = new Date(`${fimParsed.value}T23:59:59.999Z`);
      }
      filter.created_at = createdAt;
    }

    let limit = DEFAULT_LIMIT;
    if (req.query.limit != null && String(req.query.limit).trim() !== "") {
      const parsed = parseInt(String(req.query.limit), 10);
      if (isNaN(parsed) || parsed < 1) {
        res.status(400).json({ error: "limit inválido" });
        return;
      }
      limit = Math.min(parsed, MAX_LIMIT);
    }

    let offset = 0;
    if (req.query.offset != null && String(req.query.offset).trim() !== "") {
      const parsed = parseInt(String(req.query.offset), 10);
      if (isNaN(parsed) || parsed < 0) {
        res.status(400).json({ error: "offset inválido" });
        return;
      }
      offset = parsed;
    }

    const docs = await coll<EventoDoc>("eventos")
      .find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const userIds = [...new Set(docs.map((d) => d.usuario_id))];
    const emailById = new Map<number, string>();
    if (userIds.length > 0) {
      const users = await coll<{ _id: number; email: string }>("usuarios")
        .find({ _id: { $in: userIds } })
        .project({ _id: 1, email: 1 })
        .toArray();
      for (const u of users) {
        emailById.set(u._id, u.email);
      }
    }

    const items: EventoListItem[] = docs.map((d) => ({
      id: d._id,
      acao: d.acao,
      entidade_tipo: d.entidade_tipo,
      entidade_id: d.entidade_id,
      usuario_id: d.usuario_id,
      usuario_email: emailById.get(d.usuario_id) ?? null,
      created_at: formatMysqlTimestamp(d.created_at) ?? "",
      detalhes: d.detalhes ?? {},
    }));

    res.status(200).json(items);
  } catch (err) {
    console.error("Erro ao listar eventos:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de eventos" });
  }
};
