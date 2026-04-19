import { Request, Response } from "express";
import db from "../models/db";
import {
  parseRegimeConsumo,
  taxaFromPersistRow,
  taxaUnidadesPorDia,
  buildResumoTaxaMeta,
  type RegimeConsumo,
} from "../utils/pacienteMedicamentoRegime";
import { mgTotaisFromUnidades } from "../utils/concentracaoMg";
import { redactPacienteIdentificacao } from "../utils/pacienteIdentificacao";
import type { UserRole } from "../types/roles";

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
    } else {
      const unidades = Number(rec.unidades_por_ciclo);
      const intervalo = Number(rec.intervalo_ciclo_dias);
      if (isNaN(unidades) || unidades <= 0) return `Medicamento ${i + 1}: unidades por ciclo deve ser maior que zero`;
      if (!Number.isInteger(intervalo) || intervalo < 1) return `Medicamento ${i + 1}: intervalo do ciclo (dias) deve ser um inteiro maior ou igual a 1`;
    }
  }
  return null;
}

/** Valores (sem paciente_id) na ordem do INSERT em paciente_medicamentos. */
function sqlValuesForMedicamento(m: PacienteMedicamentoItem): [string, string, number, RegimeConsumo, number | null, number | null] {
  const nome = String(m.medicamento_nome).trim();
  const conc = String(m.medicamento_concentracao).trim();
  const regime = parseRegimeConsumo(m.regime_consumo);
  if (regime === "por_ciclo") {
    return [nome, conc, 0, "por_ciclo", Number(m.unidades_por_ciclo), Number(m.intervalo_ciclo_dias)];
  }
  return [nome, conc, Number(m.consumo_diario), "diario", null, null];
}

type MedicamentoPersistRow = {
  paciente_id: number;
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  regime_consumo: string | null;
  unidades_por_ciclo: number | null;
  intervalo_ciclo_dias: number | null;
};

function mapMedicamentoToResponse(r: MedicamentoPersistRow) {
  const regime = parseRegimeConsumo(r.regime_consumo);
  return {
    medicamento_nome: r.medicamento_nome,
    medicamento_concentracao: r.medicamento_concentracao,
    consumo_diario: Number(r.consumo_diario),
    regime_consumo: regime,
    unidades_por_ciclo: r.unidades_por_ciclo != null ? Number(r.unidades_por_ciclo) : null,
    intervalo_ciclo_dias: r.intervalo_ciclo_dias != null ? Number(r.intervalo_ciclo_dias) : null,
  };
}

function vinculoMgKey(pacienteId: number, nome: string, conc: string): string {
  return `${pacienteId}\0${String(nome).trim()}\0${String(conc).trim()}`;
}

type PacienteListItem = PacienteRowWithProximaRetorno & {
  medicamentos: ReturnType<typeof mapMedicamentoToResponse>[];
  lotes: string[];
};

function buildMgAcumuladoMap(
  rows: Array<{
    paciente_id: number;
    medicamento_nome: string;
    medicamento_concentracao: string;
    total_unidades: number | string;
  }>,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const r of rows) {
    const k = vinculoMgKey(r.paciente_id, r.medicamento_nome, r.medicamento_concentracao);
    const u = Number(r.total_unidades);
    const mg = mgTotaisFromUnidades(u, r.medicamento_concentracao);
    map.set(k, mg);
  }
  return map;
}

function attachMgAcumuladoMedicamentos(p: PacienteListItem, mgMap: Map<string, number | null>): PacienteListItem {
  return {
    ...p,
    medicamentos: p.medicamentos.map((m) => {
      const k = vinculoMgKey(p.id, m.medicamento_nome, m.medicamento_concentracao);
      const v = mgMap.get(k);
      return {
        ...m,
        mg_acumulado_dispensado: v !== undefined ? v : 0,
      };
    }),
  };
}

function medicamentoNomeConcKey(nome: string, conc: string): string {
  return `${String(nome).trim()}\0${String(conc).trim()}`;
}

/** Mg total dispensado por par nome+concentração (retiradas com paciente). */
function buildMgTotalDispensadoPorMedicamentoMap(
  rows: Array<{ nome: string; concentracao: string; total_unidades: number | string }>,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const r of rows) {
    const k = medicamentoNomeConcKey(r.nome, r.concentracao);
    const u = Number(r.total_unidades);
    const mg = mgTotaisFromUnidades(u, r.concentracao);
    map.set(k, mg);
  }
  return map;
}

function respondListPacientes(
  req: Request,
  res: Response,
  list: PacienteListItem[],
  ids: number[],
  placeholders: string,
): void {
  const role = req.user?.role as UserRole | undefined;
  if (ids.length === 0) {
    res.status(200).json(list.map((p) => redactPacienteIdentificacao(p, role)));
    return;
  }
  db.query(
    `SELECT rm.paciente_id, m.nome AS medicamento_nome, m.concentracao AS medicamento_concentracao,
     COALESCE(SUM(rm.quantidade), 0) AS total_unidades
     FROM retira_medications rm
     INNER JOIN medications m ON m.id = rm.medication_id
     WHERE rm.paciente_id IN (${placeholders})
     GROUP BY rm.paciente_id, m.nome, m.concentracao`,
    ids,
    (errRet: Error | null, retRows: unknown) => {
      if (errRet) {
        console.error("Erro ao agregar mg acumulado (retiradas):", errRet);
      }
      const raw =
        (retRows as Array<{
          paciente_id: number;
          medicamento_nome: string;
          medicamento_concentracao: string;
          total_unidades: number | string;
        }>) ?? [];
      const mgMap = errRet ? new Map<string, number | null>() : buildMgAcumuladoMap(raw);
      const withMg = list.map((p) => attachMgAcumuladoMedicamentos(p, mgMap));
      res.status(200).json(withMg.map((p) => redactPacienteIdentificacao(p, role)));
    },
  );
}

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
  if (retorna && (!tipo_retorno || typeof tipo_retorno !== "string" || !TIPOS_RETORNO.includes(tipo_retorno as typeof TIPOS_RETORNO[number]))) {
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

export const listPacientes = (req: Request, res: Response): void => {
  const sqlPacientes =
    "SELECT p.*, (SELECT MIN(pr.data_retorno) FROM paciente_retornos pr WHERE pr.paciente_id = p.id AND pr.data_retorno >= CURDATE()) AS proxima_data_retorno FROM pacientes p ORDER BY p.nome";
  db.query(sqlPacientes, [], (err: Error | null, results: unknown) => {
    if (err) {
      console.error("Erro ao listar pacientes:", err);
      res.status(500).json({ error: "Erro ao listar pacientes" });
      return;
    }
    const pacientes = (results as PacienteRowWithProximaRetorno[]) || [];
    if (pacientes.length === 0) {
      res.status(200).json([]);
      return;
    }
    const ids = pacientes.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    db.query(
      `SELECT paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario, regime_consumo, unidades_por_ciclo, intervalo_ciclo_dias FROM paciente_medicamentos WHERE paciente_id IN (${placeholders}) ORDER BY paciente_id`,
      ids,
      (errMed: Error | null, medRows: unknown) => {
        if (errMed) {
          console.error("Erro ao listar medicamentos dos pacientes:", errMed);
          res.status(500).json({ error: "Erro ao listar pacientes" });
          return;
        }
        const rows = (medRows as MedicamentoPersistRow[]) || [];
        const byPaciente = new Map<number, ReturnType<typeof mapMedicamentoToResponse>[]>();
        for (const r of rows) {
          const list = byPaciente.get(r.paciente_id) ?? [];
          list.push(mapMedicamentoToResponse(r));
          byPaciente.set(r.paciente_id, list);
        }
        db.query(
          `SELECT DISTINCT pm.paciente_id, m.lote FROM paciente_medicamentos pm INNER JOIN medications m ON m.nome = pm.medicamento_nome AND m.concentracao = pm.medicamento_concentracao WHERE pm.paciente_id IN (${placeholders})`,
          ids,
          (errLotes: Error | null, loteRows: unknown) => {
            if (errLotes) {
              console.error("Erro ao listar lotes dos pacientes:", errLotes);
              res.status(500).json({ error: "Erro ao listar pacientes" });
              return;
            }
            const lotesRaw = (loteRows as { paciente_id: number; lote: string }[]) || [];
            const lotesByPaciente = new Map<number, string[]>();
            for (const row of lotesRaw) {
              const list = lotesByPaciente.get(row.paciente_id) ?? [];
              if (!list.includes(row.lote)) list.push(row.lote);
              lotesByPaciente.set(row.paciente_id, list);
            }
            const out: PacienteListItem[] = pacientes.map((p) => ({
              ...p,
              medicamentos: byPaciente.get(p.id) ?? [],
              proxima_data_retorno: p.proxima_data_retorno ?? null,
              lotes: lotesByPaciente.get(p.id) ?? [],
            }));
            respondListPacientes(req, res, out, ids, placeholders);
          }
        );
      }
    );
  });
};

export const getPacienteById = (req: Request, res: Response): void => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  db.query("SELECT * FROM pacientes WHERE id = ?", [id], (err: Error | null, results: unknown) => {
    if (err) {
      console.error("Erro ao buscar paciente:", err);
      res.status(500).json({ error: "Erro ao buscar paciente" });
      return;
    }
    const rows = (results as PacienteRow[]) || [];
    if (rows.length === 0) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const paciente = rows[0];
    db.query(
      "SELECT medicamento_nome, medicamento_concentracao, consumo_diario, regime_consumo, unidades_por_ciclo, intervalo_ciclo_dias FROM paciente_medicamentos WHERE paciente_id = ?",
      [id],
      (errMed: Error | null, medRows: unknown) => {
        if (errMed) {
          console.error("Erro ao buscar medicamentos do paciente:", errMed);
          res.status(500).json({ error: "Erro ao buscar paciente" });
          return;
        }
        const list = (medRows as Omit<MedicamentoPersistRow, "paciente_id">[]) || [];
        const base: PacienteListItem = {
          ...paciente,
          proxima_data_retorno: null,
          medicamentos: list.map((m) => mapMedicamentoToResponse({ ...m, paciente_id: id })),
          lotes: [],
        };
        const role = req.user?.role as UserRole | undefined;
        db.query(
          `SELECT rm.paciente_id, m.nome AS medicamento_nome, m.concentracao AS medicamento_concentracao,
           COALESCE(SUM(rm.quantidade), 0) AS total_unidades
           FROM retira_medications rm
           INNER JOIN medications m ON m.id = rm.medication_id
           WHERE rm.paciente_id = ?
           GROUP BY rm.paciente_id, m.nome, m.concentracao`,
          [id],
          (errRet: Error | null, retRows: unknown) => {
            if (errRet) {
              console.error("Erro ao agregar mg acumulado (retiradas):", errRet);
            }
            const raw =
              (retRows as Array<{
                paciente_id: number;
                medicamento_nome: string;
                medicamento_concentracao: string;
                total_unidades: number | string;
              }>) ?? [];
            const mgMap = errRet ? new Map<string, number | null>() : buildMgAcumuladoMap(raw);
            const withMg = attachMgAcumuladoMedicamentos(base, mgMap);
            res.status(200).json(redactPacienteIdentificacao(withMg, role));
          },
        );
      }
    );
  });
};

export const createPaciente = (req: Request, res: Response): void => {
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

  db.query(
    "SELECT id FROM pacientes WHERE prontuario = ?",
    [prontNum],
    (dupErr: Error | null, dupRows: unknown) => {
      if (dupErr) {
        console.error("Erro ao verificar prontuário:", dupErr);
        res.status(500).json({ error: "Erro ao cadastrar paciente" });
        return;
      }
      if ((dupRows as { id: number }[])?.length) {
        res.status(400).json({ error: "Já existe um paciente com este prontuário" });
        return;
      }
      db.query(
        "INSERT INTO pacientes (nome, prontuario, apac, diagnostico, observacoes, telefone, data_liberacao, retorna_servico, tipo_retorno) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          String(nome).trim(),
          prontNum,
          String(apac).trim(),
          String(diagnostico).trim(),
          observacoes != null && String(observacoes).trim() !== "" ? String(observacoes).trim() : null,
          telefone != null && typeof telefone === "string" ? String(telefone).trim() : "",
          String(data_liberacao).trim(),
          retorna ? 1 : 0,
          tipoRetornoVal,
        ],
        (insErr: Error | null, result: unknown) => {
          if (insErr) {
            console.error("Erro ao inserir paciente:", insErr);
            res.status(500).json({ error: "Erro ao cadastrar paciente" });
            return;
          }
          const pacienteId = (result as { insertId?: number })?.insertId;
          if (pacienteId == null) {
            res.status(500).json({ error: "Erro ao cadastrar paciente" });
            return;
          }
          const maybeInsertRetorno = (onDone: () => void) => {
            if (!dataRetornoVal) {
              onDone();
              return;
            }
            db.query(
              "INSERT INTO paciente_retornos (paciente_id, data_retorno, tipo_retorno) VALUES (?, ?, ?)",
              [pacienteId, dataRetornoVal, tipoRetornoVal],
              (retErr: Error | null) => {
                if (retErr) console.error("Erro ao inserir data de retorno:", retErr);
                onDone();
              }
            );
          };
          const total = medList.length;
          if (total === 0) {
            maybeInsertRetorno(() => {
              res.status(201).json({ message: "Paciente cadastrado com sucesso", id: pacienteId });
            });
            return;
          }
          let inserted = 0;
          for (const m of medList) {
            const [mn, mc, cd, rg, uc, idias] = sqlValuesForMedicamento(m);
            db.query(
              "INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario, regime_consumo, unidades_por_ciclo, intervalo_ciclo_dias) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [pacienteId, mn, mc, cd, rg, uc, idias],
              (insMedErr: Error | null) => {
                if (insMedErr) console.error("Erro ao inserir vínculo medicamento:", insMedErr);
                inserted += 1;
                if (inserted === total) {
                  maybeInsertRetorno(() => {
                    res.status(201).json({ message: "Paciente cadastrado com sucesso", id: pacienteId });
                  });
                }
              }
            );
          }
        }
      );
    }
  );
};

export const updatePaciente = (req: Request, res: Response): void => {
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

  db.query(
    "SELECT id FROM pacientes WHERE prontuario = ? AND id != ?",
    [prontNum, id],
    (dupErr: Error | null, dupRows: unknown) => {
      if (dupErr) {
        console.error("Erro ao verificar prontuário:", dupErr);
        res.status(500).json({ error: "Erro ao atualizar paciente" });
        return;
      }
      if ((dupRows as { id: number }[])?.length) {
        res.status(400).json({ error: "Já existe outro paciente com este prontuário" });
        return;
      }
      db.query(
        "UPDATE pacientes SET nome = ?, prontuario = ?, apac = ?, diagnostico = ?, observacoes = ?, telefone = ?, data_liberacao = ?, retorna_servico = ?, tipo_retorno = ? WHERE id = ?",
        [
          String(nome).trim(),
          prontNum,
          String(apac).trim(),
          String(diagnostico).trim(),
          observacoes != null && String(observacoes).trim() !== "" ? String(observacoes).trim() : null,
          telefone != null && typeof telefone === "string" ? String(telefone).trim() : "",
          String(data_liberacao).trim(),
          retorna ? 1 : 0,
          tipoRetornoVal,
          id,
        ],
        (upErr: Error | null, result: unknown) => {
          if (upErr) {
            console.error("Erro ao atualizar paciente:", upErr);
            res.status(500).json({ error: "Erro ao atualizar paciente" });
            return;
          }
          if ((result as { affectedRows?: number })?.affectedRows === 0) {
            res.status(404).json({ error: "Paciente não encontrado" });
            return;
          }
          db.query("DELETE FROM paciente_medicamentos WHERE paciente_id = ?", [id], (delErr: Error | null) => {
            if (delErr) {
              console.error("Erro ao remover medicamentos do paciente:", delErr);
              res.status(500).json({ error: "Erro ao atualizar paciente" });
              return;
            }
            const maybeInsertRetorno = (onDone: () => void) => {
              if (!dataRetornoVal) {
                onDone();
                return;
              }
              db.query(
                "INSERT INTO paciente_retornos (paciente_id, data_retorno, tipo_retorno) VALUES (?, ?, ?)",
                [id, dataRetornoVal, tipoRetornoVal],
                (retErr: Error | null) => {
                  if (retErr) console.error("Erro ao inserir data de retorno:", retErr);
                  onDone();
                }
              );
            };
            if (medList.length === 0) {
              maybeInsertRetorno(() => {
                res.status(200).json({ message: "Paciente atualizado com sucesso" });
              });
              return;
            }
            let inserted = 0;
            const total = medList.length;
            for (const m of medList) {
              const [mn, mc, cd, rg, uc, idias] = sqlValuesForMedicamento(m);
              db.query(
                "INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario, regime_consumo, unidades_por_ciclo, intervalo_ciclo_dias) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [id, mn, mc, cd, rg, uc, idias],
                (insMedErr: Error | null) => {
                  if (insMedErr) console.error("Erro ao inserir vínculo medicamento:", insMedErr);
                  inserted += 1;
                  if (inserted === total) {
                    maybeInsertRetorno(() => {
                      res.status(200).json({ message: "Paciente atualizado com sucesso" });
                    });
                  }
                }
              );
            }
          });
        }
      );
    }
  );
};

export const deletePaciente = (req: Request, res: Response): void => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  db.query("DELETE FROM pacientes WHERE id = ?", [id], (err: Error | null, result: unknown) => {
    if (err) {
      console.error("Erro ao excluir paciente:", err);
      res.status(500).json({ error: "Erro ao excluir paciente" });
      return;
    }
    if ((result as { affectedRows?: number })?.affectedRows === 0) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    res.status(204).send();
  });
};

/**
 * GET /pacientes/impacto-estoque
 * Query: medicamento_nome, medicamento_concentracao, regime_consumo (opcional, default diario).
 * Se diario: consumo_diario. Se por_ciclo: unidades_por_ciclo, intervalo_ciclo_dias.
 */
export const getImpactoEstoque = (req: Request, res: Response): void => {
  const medicamento_nome = (req.query.medicamento_nome as string)?.trim();
  const medicamento_concentracao = (req.query.medicamento_concentracao as string)?.trim();
  if (!medicamento_nome || !medicamento_concentracao) {
    res.status(400).json({ error: "medicamento_nome e medicamento_concentracao são obrigatórios" });
    return;
  }

  const regime = parseRegimeConsumo(req.query.regime_consumo);
  let taxaProposta = 0;
  if (regime === "diario") {
    const consumo_diario = parseFloat((req.query.consumo_diario as string) ?? "");
    if (isNaN(consumo_diario) || consumo_diario <= 0) {
      res.status(400).json({ error: "consumo_diario deve ser um número maior que zero quando regime_consumo é diario" });
      return;
    }
    taxaProposta = taxaUnidadesPorDia("diario", consumo_diario, null, null);
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

  db.query(
    "SELECT COALESCE(SUM(quantidade), 0) AS total FROM medications WHERE nome = ? AND concentracao = ?",
    [medicamento_nome, medicamento_concentracao],
    (errEst: Error | null, estRows: unknown) => {
      if (errEst) {
        console.error("Erro ao buscar estoque:", errEst);
        res.status(500).json({ error: "Erro ao calcular impacto" });
        return;
      }
      const estoqueTotal = Number((estRows as { total: number }[])?.[0]?.total ?? 0);

      db.query(
        "SELECT paciente_id, consumo_diario, regime_consumo, unidades_por_ciclo, intervalo_ciclo_dias FROM paciente_medicamentos WHERE medicamento_nome = ? AND medicamento_concentracao = ?",
        [medicamento_nome, medicamento_concentracao],
        (errPac: Error | null, pacRows: unknown) => {
          if (errPac) {
            console.error("Erro ao buscar vínculos:", errPac);
            res.status(500).json({ error: "Erro ao calcular impacto" });
            return;
          }
          const rows = (pacRows as MedicamentoPersistRow[]) || [];
          const consumoDiarioAtual = rows.reduce((s, p) => s + taxaFromPersistRow(p), 0);
          const pacientesVinculados = new Set(rows.map((p) => p.paciente_id)).size;
          const consumoDiarioComNovo = consumoDiarioAtual + taxaProposta;
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

          res.status(200).json({
            estoqueTotal,
            pacientesVinculados,
            consumoDiarioAtual,
            consumoDiarioComNovo,
            mesesEstoqueAtual,
            mesesEstoqueComNovo,
          });
        }
      );
    }
  );
};

/** GET /pacientes/resumo-por-medicamento */
export const getResumoPorMedicamento = (req: Request, res: Response): void => {
  db.query(
    "SELECT medicamento_nome, medicamento_concentracao, paciente_id, consumo_diario, regime_consumo, unidades_por_ciclo, intervalo_ciclo_dias FROM paciente_medicamentos",
    [],
    (errPac: Error | null, pacRows: unknown) => {
      if (errPac) {
        console.error("Erro ao buscar resumo pacientes:", errPac);
        res.status(500).json({ error: "Erro ao buscar resumo" });
        return;
      }
      const rows = (pacRows as MedicamentoPersistRow[]) || [];
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
      db.query(
        `SELECT m.nome, m.concentracao, COALESCE(SUM(rm.quantidade), 0) AS total_unidades
         FROM retira_medications rm
         INNER JOIN medications m ON m.id = rm.medication_id
         WHERE rm.paciente_id IS NOT NULL
         GROUP BY m.nome, m.concentracao`,
        [],
        (errRet: Error | null, retRows: unknown) => {
          if (errRet) {
            console.error("Erro ao agregar mg dispensado no resumo:", errRet);
          }
          const raw =
            (retRows as Array<{
              nome: string;
              concentracao: string;
              total_unidades: number | string;
            }>) ?? [];
          const mgMap = errRet ? new Map<string, number | null>() : buildMgTotalDispensadoPorMedicamentoMap(raw);

          const resultados: Array<{
            medicamento_nome: string;
            medicamento_concentracao: string;
            qtdPacientes: number;
            consumoDiarioTotal: number;
            estoqueTotal: number;
            mesesEstoque: number | null;
            mgAcumuladoDispensadoTotal: number | null;
            resumoTaxaTipo: "por_ciclo_homogeneo" | "diario_apenas" | "agregado";
            porCicloUnidadesTotal?: number;
            porCicloIntervaloDias?: number;
          }> = [];
          let processados = 0;
          gruposArr.forEach((g) => {
            db.query(
              "SELECT COALESCE(SUM(quantidade), 0) AS total FROM medications WHERE nome = ? AND concentracao = ?",
              [g.medicamento_nome, g.medicamento_concentracao],
              (errEst: Error | null, estRows: unknown) => {
                const estoqueTotal = Number((estRows as { total: number }[])?.[0]?.total ?? 0);
                const consumo = g.taxaTotal;
                const mesesEstoque =
                  consumo > 0 && estoqueTotal > 0
                    ? Math.floor(estoqueTotal / (consumo * 30))
                    : consumo === 0 && estoqueTotal > 0
                      ? null
                      : 0;
                const taxaMeta = buildResumoTaxaMeta(g.linhas);
                const mgKey = medicamentoNomeConcKey(g.medicamento_nome, g.medicamento_concentracao);
                const mgVal = mgMap.get(mgKey);
                const mgAcumuladoDispensadoTotal = mgVal === undefined ? 0 : mgVal;
                const base = {
                  medicamento_nome: g.medicamento_nome,
                  medicamento_concentracao: g.medicamento_concentracao,
                  qtdPacientes: g.pacientes.size,
                  consumoDiarioTotal: consumo,
                  estoqueTotal,
                  mesesEstoque,
                  mgAcumuladoDispensadoTotal,
                };
                if (taxaMeta.resumoTaxaTipo === "por_ciclo_homogeneo") {
                  resultados.push({
                    ...base,
                    resumoTaxaTipo: "por_ciclo_homogeneo",
                    porCicloUnidadesTotal: taxaMeta.porCicloUnidadesTotal,
                    porCicloIntervaloDias: taxaMeta.porCicloIntervaloDias,
                  });
                } else if (taxaMeta.resumoTaxaTipo === "diario_apenas") {
                  resultados.push({
                    ...base,
                    resumoTaxaTipo: "diario_apenas",
                  });
                } else {
                  resultados.push({
                    ...base,
                    resumoTaxaTipo: "agregado",
                  });
                }
                processados += 1;
                if (processados === gruposArr.length) {
                  resultados.sort(
                    (a, b) =>
                      a.medicamento_nome.localeCompare(b.medicamento_nome) ||
                      a.medicamento_concentracao.localeCompare(b.medicamento_concentracao),
                  );
                  res.status(200).json(resultados);
                }
              },
            );
          });
        },
      );
    },
  );
};

/** GET /pacientes/:id/retornos */
export const getRetornos = (req: Request, res: Response): void => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  db.query("SELECT id FROM pacientes WHERE id = ?", [id], (err: Error | null, rows: unknown) => {
    if (err) {
      console.error("Erro ao buscar paciente:", err);
      res.status(500).json({ error: "Erro ao buscar histórico de retornos" });
      return;
    }
    if ((rows as { id: number }[])?.length === 0) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    db.query(
      "SELECT id, data_retorno, tipo_retorno, created_at FROM paciente_retornos WHERE paciente_id = ? ORDER BY data_retorno ASC, created_at ASC",
      [id],
      (retErr: Error | null, retRows: unknown) => {
        if (retErr) {
          console.error("Erro ao listar retornos:", retErr);
          res.status(500).json({ error: "Erro ao buscar histórico de retornos" });
          return;
        }
        const list = (retRows as { id: number; data_retorno: string; tipo_retorno: string | null; created_at: string }[]) || [];
        res.status(200).json(
          list.map((r) => ({
            id: r.id,
            data_retorno: r.data_retorno,
            tipo_retorno: r.tipo_retorno,
            created_at: r.created_at,
          }))
        );
      }
    );
  });
};

/** POST /pacientes/:id/retornos */
export const addRetorno = (req: Request, res: Response): void => {
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
  db.query("SELECT id FROM pacientes WHERE id = ?", [id], (err: Error | null, rows: unknown) => {
    if (err) {
      console.error("Erro ao buscar paciente:", err);
      res.status(500).json({ error: "Erro ao adicionar data de retorno" });
      return;
    }
    if ((rows as { id: number }[])?.length === 0) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    db.query(
      "INSERT INTO paciente_retornos (paciente_id, data_retorno, tipo_retorno) VALUES (?, ?, ?)",
      [id, data_retorno.trim(), tipoVal],
      (insErr: Error | null, result: unknown) => {
        if (insErr) {
          console.error("Erro ao inserir data de retorno:", insErr);
          res.status(500).json({ error: "Erro ao adicionar data de retorno" });
          return;
        }
        const insertId = (result as { insertId?: number })?.insertId;
        res.status(201).json({ message: "Data de retorno adicionada", id: insertId });
      }
    );
  });
};
