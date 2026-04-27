import { Request, Response } from "express";
import { coll, getDb } from "../models/mongo";
import { getNextId } from "../models/sequences";
import { extractGtinFromDigitString, normalizeGtinDigits, parseGs1Raw } from "../utils/gs1Parse";
import { dateOnly, formatMysqlTimestamp } from "../models/mappers";

interface MedicationRow {
  id: number;
  nome: string;
  lote: string;
  quantidade: number;
  classificacao?: string;
  concentracao?: string;
  forma?: string;
  data_validade: string;
  data_cadastro?: string;
}

interface CatalogRow {
  gtin: string;
  nome: string | null;
  concentracao: string | null;
  forma: string | null;
  classificacao: string | null;
}

type MedicationDoc = {
  _id: number;
  nome: string;
  lote: string;
  quantidade: number;
  classificacao?: string | null;
  concentracao?: string | null;
  forma?: string | null;
  data_validade: string | Date;
  created_at?: Date | string;
  /** GTIN-14 (ou EAN normalizado) opcional — usado em resolve-scan e futuras integrações */
  gtin?: string | null;
};

function parseOptionalGtinFromBody(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\D/g, "");
  if (s.length === 0) return null;
  const norm = normalizeGtinDigits(s);
  return norm ?? null;
}

function docToMedicationRow(doc: MedicationDoc): MedicationRow {
  return {
    id: doc._id,
    nome: doc.nome,
    lote: doc.lote,
    quantidade: doc.quantidade,
    classificacao: doc.classificacao ?? undefined,
    concentracao: doc.concentracao ?? undefined,
    forma: doc.forma ?? undefined,
    data_validade: dateOnly(doc.data_validade),
    data_cadastro: formatMysqlTimestamp(doc.created_at),
  };
}

/** Resolve leitura de código de barras / GS1 + catálogo opcional (autopreenchimento parcial). */
export const resolveScan = async (req: Request, res: Response): Promise<void> => {
  const raw = typeof req.body?.raw === "string" ? req.body.raw : "";
  if (!raw.trim()) {
    res.status(200).json({ source: "empty" as const });
    return;
  }

  const gs1 = parseGs1Raw(raw);
  const digitStr = raw.replace(/\D/g, "");
  let gtin = gs1.gtin ?? extractGtinFromDigitString(digitStr);

  const hasGs1Payload = Boolean(gs1.lote || gs1.data_validade || gs1.serial);

  type CatalogMatch = "none" | "product_catalog" | "stock";

  const applyCatalogAndRespond = (catalog: CatalogRow | null, match: CatalogMatch): void => {
    const payload: {
      source: "gs1" | "catalog" | "stock_match" | "gtin_only" | "empty";
      gtin?: string;
      lote?: string;
      data_validade?: string;
      nome?: string;
      concentracao?: string;
      forma?: string;
      classificacao?: string;
    } = { source: "empty" };

    if (gtin) payload.gtin = gtin;
    if (gs1.lote) payload.lote = gs1.lote;
    if (gs1.data_validade) payload.data_validade = gs1.data_validade;
    if (catalog?.nome) payload.nome = catalog.nome ?? undefined;
    if (catalog?.concentracao) payload.concentracao = catalog.concentracao ?? undefined;
    if (catalog?.forma) payload.forma = catalog.forma ?? undefined;
    if (catalog?.classificacao) payload.classificacao = catalog.classificacao ?? undefined;

    const anyData = Boolean(
      payload.gtin ||
        payload.lote ||
        payload.data_validade ||
        payload.nome ||
        payload.concentracao ||
        payload.forma ||
        payload.classificacao
    );
    if (!anyData) {
      payload.source = "empty";
      res.status(200).json(payload);
      return;
    }

    if (hasGs1Payload) payload.source = "gs1";
    else if (match === "product_catalog" && catalog) payload.source = "catalog";
    else if (match === "stock" && catalog) payload.source = "stock_match";
    else if (payload.gtin) payload.source = "gtin_only";
    else payload.source = "empty";

    res.status(200).json(payload);
  };

  if (!gtin) {
    applyCatalogAndRespond(null, "none");
    return;
  }

  const padded = gtin.padStart(14, "0").slice(-14);
  gtin = padded;

  try {
    const alt = padded.replace(/^0+/, "") || "0";
    const doc = await coll<Record<string, unknown> & { gtin?: string }>("medication_product_catalog").findOne({
      $or: [{ gtin: padded }, { gtin: alt }],
    });
    if (doc) {
      const row: CatalogRow = {
        gtin: String(doc.gtin),
        nome: doc.nome != null ? String(doc.nome) : null,
        concentracao: doc.concentracao != null ? String(doc.concentracao) : null,
        forma: doc.forma != null ? String(doc.forma) : null,
        classificacao: doc.classificacao != null ? String(doc.classificacao) : null,
      };
      applyCatalogAndRespond(row, "product_catalog");
      return;
    }

    const medArr = await coll<MedicationDoc>("medications")
      .find({ $or: [{ gtin: padded }, { gtin: alt }] })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    const medDoc = medArr[0];

    if (medDoc) {
      const row: CatalogRow = {
        gtin: padded,
        nome: medDoc.nome,
        concentracao: medDoc.concentracao != null ? String(medDoc.concentracao) : null,
        forma: medDoc.forma != null ? String(medDoc.forma) : null,
        classificacao: medDoc.classificacao != null ? String(medDoc.classificacao) : null,
      };
      applyCatalogAndRespond(row, "stock");
      return;
    }

    applyCatalogAndRespond(null, "none");
  } catch (err) {
    console.error("Erro ao buscar catálogo GTIN:", err);
    applyCatalogAndRespond(null, "none");
  }
};

export const registerMedication = async (req: Request, res: Response): Promise<void> => {
  const {
    nome,
    lote,
    quantidade,
    classificacao,
    concentracao,
    forma,
    data_validade,
    gtin: gtinBody,
  } = req.body;

  if (!nome || !lote || !quantidade || !data_validade) {
    res.status(400).json({ error: "Todos os campos são obrigatórios" });
    return;
  }

  const gtinNorm = parseOptionalGtinFromBody(gtinBody);

  try {
    const id = await getNextId("medications");
    const q = parseInt(quantidade, 10);
    await coll<MedicationDoc>("medications").insertOne({
      _id: id,
      nome,
      lote,
      quantidade: q,
      classificacao: classificacao ?? null,
      concentracao: concentracao ?? "",
      forma: forma ?? "",
      data_validade: String(data_validade).slice(0, 10),
      created_at: new Date(),
      ...(gtinNorm ? { gtin: gtinNorm } : {}),
    });
    try {
      const movId = await getNextId("movimentacoes");
      await coll<{
        _id: number;
        tipo: string;
        medication_id: number;
        quantidade: number;
        usuario_id: number | null;
        data_movimentacao: Date;
      }>("movimentacoes").insertOne({
        _id: movId,
        tipo: "entrada",
        medication_id: id,
        quantidade: q,
        usuario_id: null,
        data_movimentacao: new Date(),
      });
    } catch (movErr) {
      console.error("Erro ao registrar movimentação de entrada:", movErr);
    }
    res.status(201).json({ message: "Medicação registrada com sucesso" });
  } catch (err) {
    console.error("Erro ao registrar medicação:", err);
    res.status(500).json({ error: "Erro ao registrar a medicação" });
  }
};

export const getMedications = async (_req: Request, res: Response): Promise<void> => {
  try {
    const docs = await coll<MedicationDoc>("medications").find().toArray();
    const hoje = new Date();
    const medicationsWithStatus = docs.map((med: MedicationDoc) => {
      const row = docToMedicationRow(med);
      const validade = new Date(row.data_validade);
      let status: string;
      if (row.quantidade <= 0) status = "emFalta";
      else if (validade < hoje) status = "foraValidade";
      else if ((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= 90) status = "proximoVencer";
      else status = "emEstoque";
      return { ...row, status };
    });
    res.status(200).json(medicationsWithStatus);
  } catch (err) {
    console.error("Erro ao buscar medicações:", err);
    res.status(500).json({ error: "Erro ao buscar medicações" });
  }
};

export const getValidade = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const docs = await coll<MedicationDoc>("medications").find({ data_validade: { $lt: today } }).toArray();
    res.status(200).json(docs.map(docToMedicationRow));
  } catch (err) {
    console.error("Erro ao buscar medicações vencidas:", err);
    res.status(500).json({ error: "Erro ao buscar medicações vencidas" });
  }
};

export const getQuantity = async (_req: Request, res: Response): Promise<void> => {
  try {
    const agg = await coll<MedicationDoc>("medications")
      .aggregate([{ $group: { _id: null, total: { $sum: "$quantidade" } } }])
      .toArray();
    const total = agg[0]?.total ?? 0;
    res.status(200).json({ total: Number(total) });
  } catch (err) {
    console.error("Erro ao buscar a quantidade de medicações", err);
    res.status(500).json({ error: "Erro ao buscar a quantidade de medicações" });
  }
};

export const searchMedication = async (req: Request, res: Response): Promise<void> => {
  const { nome, concentracao } = req.body;
  if (!nome || !concentracao) {
    res.status(400).json({ error: "Nome e concentração são obrigatórios" });
    return;
  }
  try {
    const doc = await coll<MedicationDoc>("medications").findOne({ nome, concentracao });
    if (!doc) {
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    res.status(200).json(docToMedicationRow(doc));
  } catch (err) {
    console.error("Erro ao buscar medicação:", err);
    res.status(500).json({ error: "Erro ao buscar medicação" });
  }
};

function addStatus(med: MedicationRow): MedicationRow & { status: string } {
  const hoje = new Date();
  const validade = new Date(med.data_validade);
  let status: string;
  if (med.quantidade <= 0) status = "emFalta";
  else if (validade < hoje) status = "foraValidade";
  else if ((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= 90) status = "proximoVencer";
  else status = "emEstoque";
  return { ...med, status };
}

export const getMedicationById = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const doc = await coll<MedicationDoc>("medications").findOne({ _id: id });
    if (!doc) {
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    res.status(200).json(addStatus(docToMedicationRow(doc)));
  } catch (err) {
    console.error("Erro ao buscar medicação:", err);
    res.status(500).json({ error: "Erro ao buscar medicação" });
  }
};

export const getDistinctNomeConcentration = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await coll<MedicationDoc>("medications").aggregate<{ nome: string; concentracao: string }>([
        { $group: { _id: { nome: "$nome", concentracao: "$concentracao" } } },
        { $project: { _id: 0, nome: "$_id.nome", concentracao: "$_id.concentracao" } },
        { $sort: { nome: 1, concentracao: 1 } },
      ])
      .toArray();
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar medicamentos distintos:", err);
    res.status(500).json({ error: "Erro ao buscar medicamentos" });
  }
};

export const getLotsByNameConcentration = async (req: Request, res: Response): Promise<void> => {
  const nome = req.query.nome as string;
  const concentracao = req.query.concentracao as string;
  if (!nome?.trim() || !concentracao?.trim()) {
    res.status(400).json({ error: "Nome e concentração são obrigatórios" });
    return;
  }
  try {
    const docs = await coll<MedicationDoc>("medications")
      .find({ nome: nome.trim(), concentracao: concentracao.trim() })
      .sort({ data_validade: 1 })
      .toArray();
    res.status(200).json(docs.map((d: MedicationDoc) => addStatus(docToMedicationRow(d))));
  } catch (err) {
    console.error("Erro ao buscar lotes:", err);
    res.status(500).json({ error: "Erro ao buscar lotes" });
  }
};

export const addQuantity = async (req: Request, res: Response): Promise<void> => {
  const { medication_id, quantidade } = req.body;
  const quantidadeNum = parseInt(quantidade, 10);
  if (!medication_id || isNaN(quantidadeNum) || quantidadeNum <= 0) {
    res.status(400).json({ error: "medication_id e quantidade (número positivo) são obrigatórios" });
    return;
  }
  try {
    const mid = parseInt(String(medication_id), 10);
    const found = await coll<MedicationDoc>("medications").findOne({ _id: mid });
    if (!found) {
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    await coll<MedicationDoc>("medications").updateOne({ _id: mid }, { $inc: { quantidade: quantidadeNum } });
    try {
      const movId = await getNextId("movimentacoes");
      await coll<{
        _id: number;
        tipo: string;
        medication_id: number;
        quantidade: number;
        usuario_id: number | null;
        data_movimentacao: Date;
      }>("movimentacoes").insertOne({
        _id: movId,
        tipo: "entrada",
        medication_id: mid,
        quantidade: quantidadeNum,
        usuario_id: null,
        data_movimentacao: new Date(),
      });
    } catch (movErr) {
      console.error("Erro ao registrar movimentação de entrada:", movErr);
    }
    res.status(200).json({ message: "Quantidade adicionada com sucesso" });
  } catch (err) {
    console.error("Erro ao adicionar quantidade:", err);
    res.status(500).json({ error: "Erro ao adicionar quantidade" });
  }
};

export const updateMedication = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const { nome, lote, quantidade, classificacao, concentracao, forma, data_validade } = req.body;
  if (!nome || !lote || quantidade === undefined || quantidade === null || !data_validade) {
    res.status(400).json({ error: "nome, lote, quantidade e data_validade são obrigatórios" });
    return;
  }
  const quantidadeNum = parseInt(quantidade, 10);
  if (isNaN(quantidadeNum) || quantidadeNum < 0) {
    res.status(400).json({ error: "quantidade deve ser um número não negativo" });
    return;
  }
  try {
    const setDoc: Record<string, unknown> = {
      nome,
      lote,
      quantidade: quantidadeNum,
      classificacao: classificacao ?? "",
      concentracao: concentracao ?? "",
      forma: forma ?? "",
      data_validade: String(data_validade).slice(0, 10),
    };
    if (Object.prototype.hasOwnProperty.call(req.body as object, "gtin")) {
      const rawGtin = (req.body as { gtin?: unknown }).gtin;
      if (rawGtin === null || (typeof rawGtin === "string" && rawGtin.trim() === "")) {
        setDoc.gtin = null;
      } else {
        const g = parseOptionalGtinFromBody(rawGtin);
        if (g) setDoc.gtin = g;
      }
    }
    const r = await coll<MedicationDoc>("medications").updateOne(
      { _id: id },
      {
        $set: setDoc,
      }
    );
    if (r.matchedCount === 0) {
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    const doc = await coll<MedicationDoc>("medications").findOne({ _id: id });
    if (doc) {
      res.status(200).json(addStatus(docToMedicationRow(doc)));
    } else {
      res.status(200).json({ message: "Medicação atualizada com sucesso" });
    }
  } catch (err) {
    console.error("Erro ao atualizar medicação:", err);
    res.status(500).json({ error: "Erro ao atualizar medicação" });
  }
};

export const deleteMedication = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const db = getDb();
    const exists = await coll<MedicationDoc>("medications").findOne({ _id: id });
    if (!exists) {
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await coll<{ _id: number }>("movimentacoes").deleteMany({ medication_id: id }, { session });
        await coll<{ _id: number }>("retira_medications").deleteMany({ medication_id: id }, { session });
        const del = await coll<MedicationDoc>("medications").deleteOne({ _id: id }, { session });
        if (del.deletedCount === 0) throw new Error("NOT_FOUND");
      });
    } finally {
      await session.endSession();
    }
    res.status(204).send();
  } catch (err) {
    const e = err as Error;
    if (e.message === "NOT_FOUND") {
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    console.error("Erro ao excluir medicação:", err);
    res.status(500).json({ error: "Erro ao excluir medicação" });
  }
};
