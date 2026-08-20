import { Request, Response } from "express";
import { coll, getDb } from "../models/mongo";
import { getNextId } from "../models/sequences";
import {
  parseRegimeConsumo,
  taxaFromPersistRow,
  taxaUnidadesPorDia,
  buildResumoTaxaMeta,
  type RegimeConsumo,
} from "../utils/pacienteMedicamentoRegime";
import {
  buildPrevisaoMgFromRow,
  agregarPrevisaoMg,
  mesesEstoqueFromMg,
  taxaMgPorDiaFromRow,
  type PrevisaoMg,
} from "../utils/previsaoMg";
import { redactPacienteIdentificacao } from "../utils/pacienteIdentificacao";
import type { UserRole } from "../types/roles";
import { dateOnly, formatMysqlTimestamp } from "../models/mappers";
import { recordEventFromRequest } from "../utils/auditContext";

const TIPOS_RETORNO = ["farmacia_medico", "somente_farmacia", "farmacia_enfermagem"] as const;

interface PacienteRow {
  id: number;
  nome: string;
  prontuario: number;
  apac: string;
  diagnostico: string;
  observacoes: string | null;
  telefone: string;
  data_liberacao: string;
  /** Dia de cadastro no sistema (YYYY-MM-DD, fuso Brasília); null se o documento não tem created_at. */
  data_cadastro: string | null;
  retorna_servico: number;
  tipo_retorno: string | null;
}

interface PacienteMedicamentoItem {
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  regime_consumo?: RegimeConsumo;
  unidades_por_ciclo?: number | null;
  intervalo_ciclo_dias?: number | null;
  consumo_mg_diario?: number | null;
}

function validateMedicamentos(medicamentos: unknown): string | null {
  if (!Array.isArray(medicamentos) || medicamentos.length < 1) return "É obrigatório informar ao menos um medicamento";
  for (let i = 0; i < medicamentos.length; i++) {
    const m = medicamentos[i];
    if (!m || typeof m !== "object") return `Medicamento ${i + 1}: dados inválidos`;
    const rec = m as Record<string, unknown>;
    const nome = rec.medicamento_nome;
    const conc = rec.medicamento_concentracao;
    const regime = parseRegimeConsumo(rec.regime_consumo);
    if (!nome || typeof nome !== "string" || !String(nome).trim()) return `Medicamento ${i + 1}: nome é obrigatório`;
    if (!conc || typeof conc !== "string" || !String(conc).trim()) return `Medicamento ${i + 1}: concentração é obrigatória`;
    if (regime === "diario") {
      const consumo = Number(rec.consumo_diario);
      if (isNaN(consumo) || consumo <= 0) return `Medicamento ${i + 1}: consumo diário deve ser maior que zero`;
    } else if (regime === "por_miligrama") {
      const mg = Number(rec.consumo_mg_diario);
      if (isNaN(mg) || mg <= 0) return `Medicamento ${i + 1}: consumo em mg deve ser maior que zero`;
      if (rec.intervalo_ciclo_dias != null && String(rec.intervalo_ciclo_dias) !== "") {
        const intervalo = Number(rec.intervalo_ciclo_dias);
        if (!Number.isInteger(intervalo) || intervalo < 1)
          return `Medicamento ${i + 1}: intervalo (dias) deve ser um inteiro maior ou igual a 1`;
      }
    } else {
      const unidades = Number(rec.unidades_por_ciclo);
      const intervalo = Number(rec.intervalo_ciclo_dias);
      if (isNaN(unidades) || unidades <= 0) return `Medicamento ${i + 1}: unidades por ciclo deve ser maior que zero`;
      if (!Number.isInteger(intervalo) || intervalo < 1) return `Medicamento ${i + 1}: intervalo do ciclo (dias) deve ser um inteiro maior ou igual a 1`;
    }
  }
  return null;
}

type MedicamentoPersistValues = {
  nome: string;
  conc: string;
  consumo_diario: number;
  regime: RegimeConsumo;
  unidades_por_ciclo: number | null;
  intervalo_ciclo_dias: number | null;
  consumo_mg_diario: number | null;
};

function valuesForMedicamento(m: PacienteMedicamentoItem): MedicamentoPersistValues {
  const nome = String(m.medicamento_nome).trim();
  const conc = String(m.medicamento_concentracao).trim();
  const regime = parseRegimeConsumo(m.regime_consumo);
  if (regime === "por_ciclo") {
    return {
      nome,
      conc,
      consumo_diario: 0,
      regime: "por_ciclo",
      unidades_por_ciclo: Number(m.unidades_por_ciclo),
      intervalo_ciclo_dias: Number(m.intervalo_ciclo_dias),
      consumo_mg_diario: null,
    };
  }
  if (regime === "por_miligrama") {
    const intervalo = Number(m.intervalo_ciclo_dias);
    return {
      nome,
      conc,
      consumo_diario: 0,
      regime: "por_miligrama",
      unidades_por_ciclo: null,
      intervalo_ciclo_dias: Number.isInteger(intervalo) && intervalo >= 1 ? intervalo : 1,
      consumo_mg_diario: Number(m.consumo_mg_diario),
    };
  }
  return {
    nome,
    conc,
    consumo_diario: Number(m.consumo_diario),
    regime: "diario",
    unidades_por_ciclo: null,
    intervalo_ciclo_dias: null,
    consumo_mg_diario: null,
  };
}

type MedicamentoPersistRow = {
  paciente_id: number;
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  regime_consumo: string | null;
  unidades_por_ciclo: number | null;
  intervalo_ciclo_dias: number | null;
  consumo_mg_diario?: number | null;
};

function mapMedicamentoToResponse(r: MedicamentoPersistRow) {
  const regime = parseRegimeConsumo(r.regime_consumo);
  const base = {
    medicamento_nome: r.medicamento_nome,
    medicamento_concentracao: r.medicamento_concentracao,
    consumo_diario: Number(r.consumo_diario),
    regime_consumo: regime,
    unidades_por_ciclo: r.unidades_por_ciclo != null ? Number(r.unidades_por_ciclo) : null,
    intervalo_ciclo_dias: r.intervalo_ciclo_dias != null ? Number(r.intervalo_ciclo_dias) : null,
    consumo_mg_diario: r.consumo_mg_diario != null ? Number(r.consumo_mg_diario) : null,
  };
  const previsao_mg = buildPrevisaoMgFromRow({
    ...r,
    medicamento_concentracao: r.medicamento_concentracao,
  });
  return { ...base, previsao_mg };
}

async function respondListPacientes(req: Request, res: Response, list: PacienteListItem[]): Promise<void> {
  const role = req.user?.role as UserRole | undefined;
  res.status(200).json(list.map((p) => redactPacienteIdentificacao(p, role)));
}

function dataCadastroFromDoc(doc: Record<string, unknown>): string | null {
  if (doc.created_at == null) return null;
  const formatted = formatMysqlTimestamp(doc.created_at);
  if (!formatted) return null;
  return formatted.slice(0, 10);
}

function pacienteDocToRow(doc: Record<string, unknown>, proxima: string | null): PacienteRowWithProximaRetorno {
  return {
    id: doc._id as number,
    nome: String(doc.nome),
    prontuario: Number(doc.prontuario),
    apac: String(doc.apac),
    diagnostico: String(doc.diagnostico),
    observacoes: doc.observacoes != null ? String(doc.observacoes) : null,
    telefone: String(doc.telefone ?? ""),
    data_liberacao: dateOnly(doc.data_liberacao),
    data_cadastro: dataCadastroFromDoc(doc),
    retorna_servico: Number(doc.retorna_servico) ? 1 : 0,
    tipo_retorno: doc.tipo_retorno != null ? String(doc.tipo_retorno) : null,
    proxima_data_retorno: proxima,
  };
}

function medicamentoNomeConcKey(nome: string, conc: string): string {
  return `${String(nome).trim()}\0${String(conc).trim()}`;
}

type PacienteListItem = PacienteRowWithProximaRetorno & {
  medicamentos: ReturnType<typeof mapMedicamentoToResponse>[];
  lotes: string[];
};

function isValidDateString(s: string): boolean {
  if (!s || typeof s !== "string" || s.trim().length === 0) return false;
  const trimmed = s.trim();
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
  if (!match) return false;
  const d = new Date(trimmed);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === trimmed;
}

function validateBodyCreateUpdate(body: Record<string, unknown>, _isUpdate: boolean): string | null {
  const { nome, prontuario, apac, diagnostico, medicamentos, telefone, data_liberacao, retorna_servico, tipo_retorno, data_retorno } = body;
  if (!nome || typeof nome !== "string" || !nome.trim()) return "nome é obrigatório";
  if (prontuario === undefined || prontuario === null) return "prontuario é obrigatório";
  const prontNum = Number(prontuario);
  if (!Number.isInteger(prontNum) || prontNum < 0) return "prontuario deve ser um número inteiro não negativo";
  if (!apac || typeof apac !== "string" || !apac.trim()) return "apac é obrigatório";
  if (!diagnostico || typeof diagnostico !== "string" || !diagnostico.trim()) return "diagnostico é obrigatório";
  const errMed = validateMedicamentos(medicamentos);
  if (errMed) return errMed;
  if (telefone !== undefined && telefone !== null && typeof telefone !== "string") return "telefone deve ser texto quando informado";
  if (!data_liberacao || typeof data_liberacao !== "string" || !data_liberacao.trim()) return "data_liberacao é obrigatória";
  const retorna = Boolean(retorna_servico);
  if (retorna && (!tipo_retorno || typeof tipo_retorno !== "string" || !TIPOS_RETORNO.includes(tipo_retorno as (typeof TIPOS_RETORNO)[number]))) {
    return "tipo_retorno deve ser um de: farmacia_medico, somente_farmacia, farmacia_enfermagem quando retorna_servico é true";
  }
  if (retorna) {
    if (!_isUpdate) {
      if (!data_retorno || typeof data_retorno !== "string" || !data_retorno.trim()) {
        return "data_retorno é obrigatória quando retorna_servico é true";
      }
    }
    if (data_retorno !== undefined && data_retorno !== null && data_retorno !== "" && !isValidDateString(String(data_retorno).trim())) {
      return "data_retorno deve ser uma data válida no formato YYYY-MM-DD";
    }
  } else if (data_retorno !== undefined && data_retorno !== null && data_retorno !== "" && !isValidDateString(String(data_retorno))) {
    return "data_retorno deve ser uma data válida no formato YYYY-MM-DD";
  }
  return null;
}

interface PacienteRowWithProximaRetorno extends PacienteRow {
  proxima_data_retorno: string | null;
}

async function proximaRetornoPorPaciente(ids: number[]): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>();
  for (const id of ids) map.set(id, null);
  if (ids.length === 0) return map;
  const today = new Date().toISOString().slice(0, 10);
  const retornos = await coll<{ paciente_id: number; data_retorno: string }>("paciente_retornos")
    .find({ paciente_id: { $in: ids }, data_retorno: { $gte: today } })
    .sort({ data_retorno: 1 })
    .toArray();
  for (const r of retornos) {
    const pid = r.paciente_id;
    if (map.get(pid) === null) {
      map.set(pid, dateOnly(r.data_retorno));
    }
  }
  return map;
}

export const listPacientes = async (req: Request, res: Response): Promise<void> => {
  try {
    const docs = await coll<Record<string, unknown> & { _id: number }>("pacientes").find().sort({ nome: 1 }).toArray();
    if (docs.length === 0) {
      res.status(200).json([]);
      return;
    }
    type PacienteDoc = Record<string, unknown> & { _id: number };
    const proxMap = await proximaRetornoPorPaciente((docs as PacienteDoc[]).map((d) => d._id));
    const pacientes: PacienteRowWithProximaRetorno[] = (docs as PacienteDoc[]).map((d) =>
      pacienteDocToRow(d, proxMap.get(d._id) ?? null)
    );
    const ids = pacientes.map((p) => p.id);
    const medRows = await coll<MedicamentoPersistRow>("paciente_medicamentos")
      .find({ paciente_id: { $in: ids } })
      .sort({ paciente_id: 1 })
      .toArray();
    const byPaciente = new Map<number, ReturnType<typeof mapMedicamentoToResponse>[]>();
    for (const r of medRows) {
      const list = byPaciente.get(r.paciente_id) ?? [];
      list.push(mapMedicamentoToResponse(r));
      byPaciente.set(r.paciente_id, list);
    }

    const medsForLotes = await coll<MedicamentoPersistRow>("paciente_medicamentos")
      .find({ paciente_id: { $in: ids } })
      .toArray();
    const nomeConcSet = new Set<string>();
    for (const pm of medsForLotes) {
      nomeConcSet.add(`${String(pm.medicamento_nome).trim()}\0${String(pm.medicamento_concentracao).trim()}`);
    }
    const orConds = [...nomeConcSet].map((k) => {
      const [nome, conc] = k.split("\0");
      return { nome, concentracao: conc };
    });
    const lotesByPaciente = new Map<number, string[]>();
    if (orConds.length > 0) {
      const medMatches = await coll<{ _id: number; nome: string; concentracao: string; lote: string }>("medications")
        .find({ $or: orConds })
        .toArray();
      const loteByNomeConc = new Map<string, Set<string>>();
      for (const m of medMatches) {
        const key = medicamentoNomeConcKey(m.nome, m.concentracao);
        let s = loteByNomeConc.get(key);
        if (!s) {
          s = new Set();
          loteByNomeConc.set(key, s);
        }
        s.add(m.lote);
      }
      for (const pm of medsForLotes) {
        const key = medicamentoNomeConcKey(String(pm.medicamento_nome), String(pm.medicamento_concentracao));
        const lotes = loteByNomeConc.get(key);
        if (!lotes) continue;
        const pid = pm.paciente_id as number;
        const list = lotesByPaciente.get(pid) ?? [];
        for (const l of lotes) {
          if (!list.includes(l)) list.push(l);
        }
        lotesByPaciente.set(pid, list);
      }
    }

    const out: PacienteListItem[] = pacientes.map((p) => ({
      ...p,
      medicamentos: byPaciente.get(p.id) ?? [],
      proxima_data_retorno: p.proxima_data_retorno ?? null,
      lotes: lotesByPaciente.get(p.id) ?? [],
    }));
    await respondListPacientes(req, res, out);
  } catch (err) {
    console.error("Erro ao listar pacientes:", err);
    res.status(500).json({ error: "Erro ao listar pacientes" });
  }
};

export const getPacienteById = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const doc = await coll<Record<string, unknown> & { _id: number }>("pacientes").findOne({ _id: id });
    if (!doc) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const paciente = pacienteDocToRow(doc as Record<string, unknown>, null);
    const list = await coll<MedicamentoPersistRow>("paciente_medicamentos").find({ paciente_id: id }).toArray();
    const base: PacienteListItem = {
      ...paciente,
      proxima_data_retorno: null,
      medicamentos: list.map((m: MedicamentoPersistRow) =>
        mapMedicamentoToResponse({ ...m, paciente_id: id })
      ),
      lotes: [],
    };
    const role = req.user?.role as UserRole | undefined;
    res.status(200).json(redactPacienteIdentificacao(base, role));
  } catch (err) {
    console.error("Erro ao buscar paciente:", err);
    res.status(500).json({ error: "Erro ao buscar paciente" });
  }
};

export const createPaciente = async (req: Request, res: Response): Promise<void> => {
  const errMsg = validateBodyCreateUpdate(req.body, false);
  if (errMsg) {
    res.status(400).json({ error: errMsg });
    return;
  }
  const {
    nome,
    prontuario,
    apac,
    diagnostico,
    medicamentos,
    observacoes,
    telefone,
    data_liberacao,
    retorna_servico,
    tipo_retorno,
    data_retorno,
  } = req.body;
  const prontNum = Number(prontuario);
  const retorna = Boolean(retorna_servico);
  const tipoRetornoVal = retorna && tipo_retorno ? String(tipo_retorno) : null;
  const dataRetornoVal =
    retorna && data_retorno != null && String(data_retorno).trim() !== "" && isValidDateString(String(data_retorno))
      ? String(data_retorno).trim()
      : null;
  const medList = medicamentos as PacienteMedicamentoItem[];

  try {
    const dup = await coll<{ prontuario: number }>("pacientes").findOne({ prontuario: prontNum });
    if (dup) {
      res.status(400).json({ error: "Já existe um paciente com este prontuário" });
      return;
    }
    const pacienteId = await getNextId("pacientes");
    await coll<Record<string, unknown> & { _id: number }>("pacientes").insertOne({
      _id: pacienteId,
      nome: String(nome).trim(),
      prontuario: prontNum,
      apac: String(apac).trim(),
      diagnostico: String(diagnostico).trim(),
      observacoes:
        observacoes != null && String(observacoes).trim() !== "" ? String(observacoes).trim() : null,
      telefone: telefone != null && typeof telefone === "string" ? String(telefone).trim() : "",
      data_liberacao: String(data_liberacao).trim(),
      retorna_servico: retorna ? 1 : 0,
      tipo_retorno: tipoRetornoVal,
      created_at: new Date(),
    });

    for (const m of medList) {
      const v = valuesForMedicamento(m);
      const pmId = await getNextId("paciente_medicamentos");
      await coll<MedicamentoPersistRow & { _id: number }>("paciente_medicamentos").insertOne({
        _id: pmId,
        paciente_id: pacienteId,
        medicamento_nome: v.nome,
        medicamento_concentracao: v.conc,
        consumo_diario: v.consumo_diario,
        regime_consumo: v.regime,
        unidades_por_ciclo: v.unidades_por_ciclo,
        intervalo_ciclo_dias: v.intervalo_ciclo_dias,
        consumo_mg_diario: v.consumo_mg_diario,
      });
    }

    if (dataRetornoVal) {
      const rid = await getNextId("paciente_retornos");
      await coll<{ _id: number; paciente_id: number; data_retorno: string; tipo_retorno: string | null; created_at: Date }>(
        "paciente_retornos"
      ).insertOne({
        _id: rid,
        paciente_id: pacienteId,
        data_retorno: dataRetornoVal,
        tipo_retorno: tipoRetornoVal,
        created_at: new Date(),
      });
    }

    await recordEventFromRequest(req, {
      acao: "paciente.create",
      entidade_tipo: "paciente",
      entidade_id: pacienteId,
      detalhes: {
        nome: String(nome).trim(),
        prontuario: prontNum,
      },
    });

    res.status(201).json({ message: "Paciente cadastrado com sucesso", id: pacienteId });
  } catch (err) {
    console.error("Erro ao cadastrar paciente:", err);
    res.status(500).json({ error: "Erro ao cadastrar paciente" });
  }
};

export const updatePaciente = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const errMsg = validateBodyCreateUpdate(req.body, true);
  if (errMsg) {
    res.status(400).json({ error: errMsg });
    return;
  }
  const {
    nome,
    prontuario,
    apac,
    diagnostico,
    medicamentos,
    observacoes,
    telefone,
    data_liberacao,
    retorna_servico,
    tipo_retorno,
    data_retorno,
  } = req.body;
  const prontNum = Number(prontuario);
  const retorna = Boolean(retorna_servico);
  const tipoRetornoVal = retorna && tipo_retorno ? String(tipo_retorno) : null;
  const dataRetornoVal =
    data_retorno != null && String(data_retorno).trim() !== "" && isValidDateString(String(data_retorno))
      ? String(data_retorno).trim()
      : null;
  const medList = medicamentos as PacienteMedicamentoItem[];

  try {
    const dup = await coll<{ _id: number; prontuario: number }>("pacientes").findOne({ prontuario: prontNum, _id: { $ne: id } });
    if (dup) {
      res.status(400).json({ error: "Já existe outro paciente com este prontuário" });
      return;
    }
    const r = await coll<Record<string, unknown> & { _id: number }>("pacientes").updateOne(
      { _id: id },
      {
        $set: {
          nome: String(nome).trim(),
          prontuario: prontNum,
          apac: String(apac).trim(),
          diagnostico: String(diagnostico).trim(),
          observacoes:
            observacoes != null && String(observacoes).trim() !== "" ? String(observacoes).trim() : null,
          telefone: telefone != null && typeof telefone === "string" ? String(telefone).trim() : "",
          data_liberacao: String(data_liberacao).trim(),
          retorna_servico: retorna ? 1 : 0,
          tipo_retorno: tipoRetornoVal,
        },
      }
    );
    if (r.matchedCount === 0) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }

    await coll<MedicamentoPersistRow>("paciente_medicamentos").deleteMany({ paciente_id: id });
    for (const m of medList) {
      const v = valuesForMedicamento(m);
      const pmId = await getNextId("paciente_medicamentos");
      await coll<MedicamentoPersistRow & { _id: number }>("paciente_medicamentos").insertOne({
        _id: pmId,
        paciente_id: id,
        medicamento_nome: v.nome,
        medicamento_concentracao: v.conc,
        consumo_diario: v.consumo_diario,
        regime_consumo: v.regime,
        unidades_por_ciclo: v.unidades_por_ciclo,
        intervalo_ciclo_dias: v.intervalo_ciclo_dias,
        consumo_mg_diario: v.consumo_mg_diario,
      });
    }

    if (dataRetornoVal) {
      const rid = await getNextId("paciente_retornos");
      await coll<{ _id: number; paciente_id: number; data_retorno: string; tipo_retorno: string | null; created_at: Date }>(
        "paciente_retornos"
      ).insertOne({
        _id: rid,
        paciente_id: id,
        data_retorno: dataRetornoVal,
        tipo_retorno: tipoRetornoVal,
        created_at: new Date(),
      });
    }

    await recordEventFromRequest(req, {
      acao: "paciente.update",
      entidade_tipo: "paciente",
      entidade_id: id,
      detalhes: {
        nome: String(nome).trim(),
        prontuario: prontNum,
      },
    });

    res.status(200).json({ message: "Paciente atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar paciente:", err);
    res.status(500).json({ error: "Erro ao atualizar paciente" });
  }
};

export const deletePaciente = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const existing = await coll<{ _id: number; nome?: string; prontuario?: number }>("pacientes").findOne({
      _id: id,
    });
    if (!existing) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }

    const db = getDb();
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await coll<MedicamentoPersistRow>("paciente_medicamentos").deleteMany({ paciente_id: id }, { session });
        await coll<{ paciente_id: number }>("paciente_retornos").deleteMany({ paciente_id: id }, { session });
        await coll<{ paciente_id: number | null }>("retira_medications").updateMany(
          { paciente_id: id },
          { $set: { paciente_id: null } },
          { session }
        );
        const del = await coll<Record<string, unknown> & { _id: number }>("pacientes").deleteOne({ _id: id }, { session });
        if (del.deletedCount === 0) throw new Error("NOT_FOUND");
      });
    } finally {
      await session.endSession();
    }

    await recordEventFromRequest(req, {
      acao: "paciente.delete",
      entidade_tipo: "paciente",
      entidade_id: id,
      detalhes: {
        nome: existing.nome ?? "",
        prontuario: existing.prontuario ?? null,
      },
    });

    res.status(204).send();
  } catch (err) {
    if ((err as Error).message === "NOT_FOUND") {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    console.error("Erro ao excluir paciente:", err);
    res.status(500).json({ error: "Erro ao excluir paciente" });
  }
};

export const getImpactoEstoque = async (req: Request, res: Response): Promise<void> => {
  const medicamento_nome = (req.query.medicamento_nome as string)?.trim();
  const medicamento_concentracao = (req.query.medicamento_concentracao as string)?.trim();
  if (!medicamento_nome || !medicamento_concentracao) {
    res.status(400).json({ error: "medicamento_nome e medicamento_concentracao são obrigatórios" });
    return;
  }

  const regime = parseRegimeConsumo(req.query.regime_consumo);
  let taxaProposta = 0;
  let taxaMgProposta: number | null = null;

  if (regime === "diario") {
    const consumo_diario = parseFloat((req.query.consumo_diario as string) ?? "");
    if (isNaN(consumo_diario) || consumo_diario <= 0) {
      res.status(400).json({ error: "consumo_diario deve ser um número maior que zero quando regime_consumo é diario" });
      return;
    }
    taxaProposta = taxaUnidadesPorDia("diario", consumo_diario, null, null);
  } else if (regime === "por_miligrama") {
    const consumo_mg = parseFloat((req.query.consumo_mg_diario as string) ?? "");
    if (isNaN(consumo_mg) || consumo_mg <= 0) {
      res.status(400).json({ error: "consumo_mg_diario deve ser um número maior que zero quando regime_consumo é por_miligrama" });
      return;
    }
    let intervaloMg = 1;
    const intervaloRaw = req.query.intervalo_ciclo_dias as string | undefined;
    if (intervaloRaw != null && String(intervaloRaw).trim() !== "") {
      const iv = parseInt(intervaloRaw, 10);
      if (!Number.isInteger(iv) || iv < 1) {
        res.status(400).json({ error: "intervalo_ciclo_dias deve ser um inteiro maior ou igual a 1 quando regime_consumo é por_miligrama" });
        return;
      }
      intervaloMg = iv;
    }
    taxaMgProposta = consumo_mg / intervaloMg;
  } else {
    const unidades = parseFloat((req.query.unidades_por_ciclo as string) ?? "");
    const intervalo = parseInt((req.query.intervalo_ciclo_dias as string) ?? "", 10);
    if (isNaN(unidades) || unidades <= 0) {
      res.status(400).json({ error: "unidades_por_ciclo deve ser um número maior que zero quando regime_consumo é por_ciclo" });
      return;
    }
    if (!Number.isInteger(intervalo) || intervalo < 1) {
      res.status(400).json({ error: "intervalo_ciclo_dias deve ser um inteiro maior ou igual a 1 quando regime_consumo é por_ciclo" });
      return;
    }
    taxaProposta = taxaUnidadesPorDia("por_ciclo", 0, unidades, intervalo);
  }

  try {
    const estAgg = await coll<{ _id: number; quantidade: number; nome: string; concentracao: string }>("medications")
      .aggregate([{ $match: { nome: medicamento_nome, concentracao: medicamento_concentracao } }, { $group: { _id: null, total: { $sum: "$quantidade" } } }])
      .toArray();
    const estoqueTotal = Number(estAgg[0]?.total ?? 0);

    const rows = await coll<MedicamentoPersistRow>("paciente_medicamentos")
      .find({ medicamento_nome, medicamento_concentracao })
      .toArray();
    const consumoDiarioAtual = rows.reduce((s: number, p: MedicamentoPersistRow) => s + taxaFromPersistRow(p), 0);
    const pacientesVinculados = new Set(rows.map((p: MedicamentoPersistRow) => p.paciente_id)).size;

    if (regime === "por_miligrama") {
      taxaProposta = taxaFromPersistRow({
        regime_consumo: "por_miligrama",
        consumo_diario: 0,
        unidades_por_ciclo: null,
        intervalo_ciclo_dias: null,
        consumo_mg_diario: taxaMgProposta,
        medicamento_concentracao: medicamento_concentracao,
      });
    } else if (taxaMgProposta == null) {
      taxaMgProposta = taxaMgPorDiaFromRow({
        regime_consumo: regime,
        consumo_diario: regime === "diario" ? parseFloat((req.query.consumo_diario as string) ?? "") : 0,
        unidades_por_ciclo: regime === "por_ciclo" ? parseFloat((req.query.unidades_por_ciclo as string) ?? "") : null,
        intervalo_ciclo_dias: regime === "por_ciclo" ? parseInt((req.query.intervalo_ciclo_dias as string) ?? "", 10) : null,
        medicamento_concentracao: medicamento_concentracao,
      });
    }

    let consumoMgDiarioAtual = 0;
    for (const p of rows) {
      const mg = taxaMgPorDiaFromRow({ ...p, medicamento_concentracao: p.medicamento_concentracao });
      if (mg != null) consumoMgDiarioAtual += mg;
    }
    const consumoDiarioComNovo = consumoDiarioAtual + taxaProposta;
    const consumoMgDiarioComNovo = consumoMgDiarioAtual + (taxaMgProposta ?? 0);
    const diasPorMes = 30;
    const mesesEstoqueAtual =
      consumoDiarioAtual > 0 && estoqueTotal > 0
        ? Math.floor(estoqueTotal / (consumoDiarioAtual * diasPorMes))
        : consumoDiarioAtual === 0 && estoqueTotal > 0
          ? null
          : 0;
    const mesesEstoqueComNovo =
      consumoDiarioComNovo > 0 && estoqueTotal > 0
        ? Math.floor(estoqueTotal / (consumoDiarioComNovo * diasPorMes))
        : consumoDiarioComNovo === 0 && estoqueTotal > 0
          ? null
          : 0;
    const mesesEstoqueMgAtual = mesesEstoqueFromMg(estoqueTotal, consumoMgDiarioAtual > 0 ? consumoMgDiarioAtual : null, medicamento_concentracao);
    const mesesEstoqueMgComNovo = mesesEstoqueFromMg(
      estoqueTotal,
      consumoMgDiarioComNovo > 0 ? consumoMgDiarioComNovo : null,
      medicamento_concentracao
    );

    res.status(200).json({
      estoqueTotal,
      pacientesVinculados,
      consumoDiarioAtual,
      consumoDiarioComNovo,
      mesesEstoqueAtual,
      mesesEstoqueComNovo,
      consumoMgDiarioAtual,
      consumoMgDiarioComNovo,
      consumoMgMesComNovo: consumoMgDiarioComNovo > 0 ? consumoMgDiarioComNovo * diasPorMes : null,
      mesesEstoqueMgAtual,
      mesesEstoqueMgComNovo,
    });
  } catch (err) {
    console.error("Erro ao calcular impacto:", err);
    res.status(500).json({ error: "Erro ao calcular impacto" });
  }
};

export const getResumoPorMedicamento = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await coll<MedicamentoPersistRow>("paciente_medicamentos").find().toArray();
    const grupos = new Map<
      string,
      {
        medicamento_nome: string;
        medicamento_concentracao: string;
        pacientes: Set<number>;
        taxaTotal: number;
        linhas: MedicamentoPersistRow[];
      }
    >();
    for (const r of rows) {
      const key = `${r.medicamento_nome}\0${r.medicamento_concentracao}`;
      let g = grupos.get(key);
      if (!g) {
        g = {
          medicamento_nome: r.medicamento_nome,
          medicamento_concentracao: r.medicamento_concentracao,
          pacientes: new Set(),
          taxaTotal: 0,
          linhas: [],
        };
        grupos.set(key, g);
      }
      g.pacientes.add(r.paciente_id);
      g.taxaTotal += taxaFromPersistRow(r);
      g.linhas.push(r);
    }
    const gruposArr = Array.from(grupos.values());
    if (gruposArr.length === 0) {
      res.status(200).json([]);
      return;
    }

    const resultados: Array<{
      medicamento_nome: string;
      medicamento_concentracao: string;
      qtdPacientes: number;
      consumoDiarioTotal: number;
      estoqueTotal: number;
      mesesEstoque: number | null;
      mesesEstoqueMg: number | null;
      previsaoMgTotal: PrevisaoMg;
      resumoTaxaTipo: "por_ciclo_homogeneo" | "diario_apenas" | "agregado";
      porCicloUnidadesTotal?: number;
      porCicloIntervaloDias?: number;
    }> = [];

    for (const g of gruposArr) {
      const estAgg = await coll<{ quantidade: number; nome: string; concentracao: string }>("medications")
        .aggregate([{ $match: { nome: g.medicamento_nome, concentracao: g.medicamento_concentracao } }, { $group: { _id: null, total: { $sum: "$quantidade" } } }])
        .toArray();
      const estoqueTotal = Number(estAgg[0]?.total ?? 0);
      const consumo = g.taxaTotal;
      const mesesEstoque =
        consumo > 0 && estoqueTotal > 0 ? Math.floor(estoqueTotal / (consumo * 30)) : consumo === 0 && estoqueTotal > 0 ? null : 0;
      const previsaoMgTotal = agregarPrevisaoMg(
        g.linhas.map((r) => ({ ...r, medicamento_concentracao: r.medicamento_concentracao }))
      );
      const mesesEstoqueMg = mesesEstoqueFromMg(
        estoqueTotal,
        previsaoMgTotal.mg_dia_previsto,
        g.medicamento_concentracao
      );
      const taxaMeta = buildResumoTaxaMeta(g.linhas);
      const base = {
        medicamento_nome: g.medicamento_nome,
        medicamento_concentracao: g.medicamento_concentracao,
        qtdPacientes: g.pacientes.size,
        consumoDiarioTotal: consumo,
        estoqueTotal,
        mesesEstoque,
        mesesEstoqueMg,
        previsaoMgTotal,
      };
      if (taxaMeta.resumoTaxaTipo === "por_ciclo_homogeneo") {
        resultados.push({
          ...base,
          resumoTaxaTipo: "por_ciclo_homogeneo",
          porCicloUnidadesTotal: taxaMeta.porCicloUnidadesTotal,
          porCicloIntervaloDias: taxaMeta.porCicloIntervaloDias,
        });
      } else if (taxaMeta.resumoTaxaTipo === "diario_apenas") {
        resultados.push({ ...base, resumoTaxaTipo: "diario_apenas" });
      } else {
        resultados.push({ ...base, resumoTaxaTipo: "agregado" });
      }
    }

    resultados.sort(
      (a, b) =>
        a.medicamento_nome.localeCompare(b.medicamento_nome) || a.medicamento_concentracao.localeCompare(b.medicamento_concentracao)
    );
    res.status(200).json(resultados);
  } catch (err) {
    console.error("Erro ao buscar resumo:", err);
    res.status(500).json({ error: "Erro ao buscar resumo" });
  }
};

export const getRetornos = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const p = await coll<{ _id: number }>("pacientes").findOne({ _id: id });
    if (!p) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const list = await coll<{ _id: number; data_retorno: string; tipo_retorno: string | null; created_at: Date | string }>(
      "paciente_retornos"
    )
      .find({ paciente_id: id })
      .sort({ data_retorno: 1, created_at: 1 })
      .toArray();
    type RetornoDoc = {
      _id: number;
      data_retorno: string;
      tipo_retorno: string | null;
      created_at: Date | string;
    };
    res.status(200).json(
      (list as RetornoDoc[]).map((r) => ({
        id: r._id,
        data_retorno: dateOnly(r.data_retorno),
        tipo_retorno: r.tipo_retorno,
        created_at: formatMysqlTimestamp(r.created_at) ?? "",
      }))
    );
  } catch (err) {
    console.error("Erro ao listar retornos:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de retornos" });
  }
};

export const addRetorno = async (req: Request, res: Response): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const { data_retorno, tipo_retorno } = req.body;
  if (!data_retorno || typeof data_retorno !== "string" || !data_retorno.trim()) {
    res.status(400).json({ error: "data_retorno é obrigatória" });
    return;
  }
  if (!isValidDateString(data_retorno.trim())) {
    res.status(400).json({ error: "data_retorno deve ser uma data válida no formato YYYY-MM-DD" });
    return;
  }
  const tipoVal =
    tipo_retorno != null && typeof tipo_retorno === "string" && TIPOS_RETORNO.includes(tipo_retorno as (typeof TIPOS_RETORNO)[number])
      ? tipo_retorno.trim()
      : null;
  try {
    const p = await coll<{ _id: number; nome?: string }>("pacientes").findOne({ _id: id });
    if (!p) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const insertId = await getNextId("paciente_retornos");
    await coll<{ _id: number; paciente_id: number; data_retorno: string; tipo_retorno: string | null; created_at: Date }>(
      "paciente_retornos"
    ).insertOne({
      _id: insertId,
      paciente_id: id,
      data_retorno: data_retorno.trim(),
      tipo_retorno: tipoVal,
      created_at: new Date(),
    });
    await recordEventFromRequest(req, {
      acao: "paciente.retorno.add",
      entidade_tipo: "paciente",
      entidade_id: id,
      detalhes: {
        data_retorno: data_retorno.trim(),
        tipo_retorno: tipoVal,
        paciente_nome: p.nome ?? "",
      },
    });
    res.status(201).json({ message: "Data de retorno adicionada", id: insertId });
  } catch (err) {
    console.error("Erro ao inserir data de retorno:", err);
    res.status(500).json({ error: "Erro ao adicionar data de retorno" });
  }
};
