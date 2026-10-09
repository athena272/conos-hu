import type { Request, Response } from "express";
import { coll } from "../models/mongo";
import { formatMysqlTimestamp } from "../models/mappers";
import type { EventoAcao, EventoDoc, EventoListItem } from "../types/evento";
import { EVENTO_ACOES, isEventoAcao, isEventoEntidade } from "../types/evento";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Portuguese UI labels → action codes (for server-side `q` search parity). */
const ACAO_LABELS: Record<EventoAcao, string> = {
  "medication.create": "Cadastro de medicamento",
  "medication.add_quantity": "Entrada de quantidade",
  "medication.update": "Atualização de medicamento",
  "medication.delete": "Exclusão de medicamento",
  "medication.withdraw": "Retirada de medicamento",
  "paciente.create": "Cadastro de paciente",
  "paciente.update": "Atualização de paciente",
  "paciente.delete": "Exclusão de paciente",
  "paciente.retorno.add": "Adição de retorno",
  "usuario.register": "Registro de usuário",
  "usuario.identify": "Identificação de sessão",
};

const DETALHES_SEARCH_FIELDS = [
  "detalhes.nome",
  "detalhes.lote",
  "detalhes.concentracao",
  "detalhes.paciente_nome",
  "detalhes.prontuario",
  "detalhes.email",
  "detalhes.operador_nome",
  "detalhes.ip",
] as const;

function parseDateOnlyParam(
  raw: unknown,
  field: string,
): { ok: true; value: string } | { ok: false; error: string } {
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function acoesMatchingQuery(q: string): EventoAcao[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return EVENTO_ACOES.filter((acao) => {
    const label = ACAO_LABELS[acao].toLowerCase();
    return acao.toLowerCase().includes(needle) || label.includes(needle);
  });
}

async function buildSearchOrClauses(q: string): Promise<Record<string, unknown>[]> {
  const needle = q.trim();
  if (!needle) return [];

  const re = new RegExp(escapeRegex(needle), "i");
  const orClauses: Record<string, unknown>[] = [
    { acao: re },
    { entidade_tipo: re },
  ];

  for (const field of DETALHES_SEARCH_FIELDS) {
    orClauses.push({ [field]: re });
  }

  const matchedAcoes = acoesMatchingQuery(needle);
  if (matchedAcoes.length > 0) {
    orClauses.push({ acao: { $in: matchedAcoes } });
  }

  const entidadeIdMatch = needle.match(/#(\d+)/);
  if (entidadeIdMatch) {
    const id = parseInt(entidadeIdMatch[1]!, 10);
    if (!Number.isNaN(id)) {
      orClauses.push({ entidade_id: id });
    }
  }

  const users = await coll<{ _id: number; email: string }>("usuarios")
    .find({ email: re })
    .project({ _id: 1 })
    .limit(100)
    .toArray();
  if (users.length > 0) {
    orClauses.push({ usuario_id: { $in: users.map((u) => u._id) } });
  }

  const userIdMatch = needle.match(/usu[aá]rio\s*#?\s*(\d+)/i);
  if (userIdMatch) {
    const id = parseInt(userIdMatch[1]!, 10);
    if (!Number.isNaN(id)) {
      orClauses.push({ usuario_id: id });
    }
  }

  return orClauses;
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

    const qRaw = req.query.q != null ? String(req.query.q).trim() : "";
    if (qRaw) {
      const orClauses = await buildSearchOrClauses(qRaw);
      if (orClauses.length > 0) {
        const baseKeys = Object.keys(filter);
        if (baseKeys.length === 0) {
          filter.$or = orClauses;
        } else {
          const base: Record<string, unknown> = {};
          for (const key of baseKeys) {
            base[key] = filter[key];
            delete filter[key];
          }
          filter.$and = [base, { $or: orClauses }];
        }
      }
    }

    let page = 1;
    const hasPage =
      req.query.page != null && String(req.query.page).trim() !== "";
    if (hasPage) {
      const parsed = parseInt(String(req.query.page), 10);
      if (isNaN(parsed) || parsed < 1) {
        res.status(400).json({ error: "page inválido" });
        return;
      }
      page = parsed;
    } else if (req.query.offset != null && String(req.query.offset).trim() !== "") {
      const parsed = parseInt(String(req.query.offset), 10);
      if (isNaN(parsed) || parsed < 0) {
        res.status(400).json({ error: "offset inválido" });
        return;
      }
      page = Math.floor(parsed / limit) + 1;
    }

    const total = await coll<EventoDoc>("eventos").countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    if (page > totalPages) {
      page = totalPages;
    }
    const offset = (page - 1) * limit;

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

    const items: EventoListItem[] = docs.map((d) => {
      const detalhes = d.detalhes ?? {};
      const operadorFromDetalhes =
        typeof detalhes.operador_nome === "string" && detalhes.operador_nome.trim()
          ? detalhes.operador_nome.trim()
          : null;
      return {
        id: d._id,
        acao: d.acao,
        entidade_tipo: d.entidade_tipo,
        entidade_id: d.entidade_id,
        usuario_id: d.usuario_id,
        usuario_email: emailById.get(d.usuario_id) ?? null,
        operador_nome: operadorFromDetalhes,
        created_at: formatMysqlTimestamp(d.created_at) ?? "",
        detalhes,
      };
    });

    res.status(200).json({
      items,
      total,
      page,
      totalPages,
      limit,
    });
  } catch (err) {
    console.error("Erro ao listar eventos:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de eventos" });
  }
};
