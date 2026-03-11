import { Request, Response } from "express";
import db from "../models/db";

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
}

function validateMedicamentos(medicamentos: unknown): string | null {
  if (!Array.isArray(medicamentos) || medicamentos.length < 1) return "É obrigatório informar ao menos um medicamento";
  for (let i = 0; i < medicamentos.length; i++) {
    const m = medicamentos[i];
    if (!m || typeof m !== "object") return `Medicamento ${i + 1}: dados inválidos`;
    const nome = (m as Record<string, unknown>).medicamento_nome;
    const conc = (m as Record<string, unknown>).medicamento_concentracao;
    const consumo = Number((m as Record<string, unknown>).consumo_diario);
    if (!nome || typeof nome !== "string" || !String(nome).trim()) return `Medicamento ${i + 1}: nome é obrigatório`;
    if (!conc || typeof conc !== "string" || !String(conc).trim()) return `Medicamento ${i + 1}: concentração é obrigatória`;
    if (isNaN(consumo) || consumo <= 0) return `Medicamento ${i + 1}: consumo diário deve ser maior que zero`;
  }
  return null;
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
  if (data_retorno !== undefined && data_retorno !== null && data_retorno !== "" && !isValidDateString(String(data_retorno))) {
    return "data_retorno deve ser uma data válida no formato YYYY-MM-DD";
  }
  return null;
}

export const listPacientes = (req: Request, res: Response): void => {
  db.query("SELECT * FROM pacientes ORDER BY nome", [], (err: Error | null, results: unknown) => {
    if (err) {
      console.error("Erro ao listar pacientes:", err);
      res.status(500).json({ error: "Erro ao listar pacientes" });
      return;
    }
    const pacientes = (results as PacienteRow[]) || [];
    if (pacientes.length === 0) {
      res.status(200).json([]);
      return;
    }
    const ids = pacientes.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    db.query(
      `SELECT paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario FROM paciente_medicamentos WHERE paciente_id IN (${placeholders}) ORDER BY paciente_id`,
      ids,
      (errMed: Error | null, medRows: unknown) => {
        if (errMed) {
          console.error("Erro ao listar medicamentos dos pacientes:", errMed);
          res.status(500).json({ error: "Erro ao listar pacientes" });
          return;
        }
        const rows = (medRows as { paciente_id: number; medicamento_nome: string; medicamento_concentracao: string; consumo_diario: number }[]) || [];
        const byPaciente = new Map<number, PacienteMedicamentoItem[]>();
        for (const r of rows) {
          const list = byPaciente.get(r.paciente_id) ?? [];
          list.push({
            medicamento_nome: r.medicamento_nome,
            medicamento_concentracao: r.medicamento_concentracao,
            consumo_diario: Number(r.consumo_diario),
          });
          byPaciente.set(r.paciente_id, list);
        }
        const out = pacientes.map((p) => ({
          ...p,
          medicamentos: byPaciente.get(p.id) ?? [],
        }));
        res.status(200).json(out);
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
      "SELECT medicamento_nome, medicamento_concentracao, consumo_diario FROM paciente_medicamentos WHERE paciente_id = ?",
      [id],
      (errMed: Error | null, medRows: unknown) => {
        if (errMed) {
          console.error("Erro ao buscar medicamentos do paciente:", errMed);
          res.status(500).json({ error: "Erro ao buscar paciente" });
          return;
        }
        const list = (medRows as { medicamento_nome: string; medicamento_concentracao: string; consumo_diario: number }[]) || [];
        res.status(200).json({
          ...paciente,
          medicamentos: list.map((m) => ({
            medicamento_nome: m.medicamento_nome,
            medicamento_concentracao: m.medicamento_concentracao,
            consumo_diario: Number(m.consumo_diario),
          })),
        });
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
            db.query(
              "INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario) VALUES (?, ?, ?, ?)",
              [pacienteId, String(m.medicamento_nome).trim(), String(m.medicamento_concentracao).trim(), Number(m.consumo_diario)],
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
              db.query(
                "INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario) VALUES (?, ?, ?, ?)",
                [id, String(m.medicamento_nome).trim(), String(m.medicamento_concentracao).trim(), Number(m.consumo_diario)],
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

/** GET /pacientes/impacto-estoque?medicamento_nome=...&medicamento_concentracao=...&consumo_diario=... */
export const getImpactoEstoque = (req: Request, res: Response): void => {
  const medicamento_nome = (req.query.medicamento_nome as string)?.trim();
  const medicamento_concentracao = (req.query.medicamento_concentracao as string)?.trim();
  const consumo_diario = parseFloat((req.query.consumo_diario as string) ?? "");
  if (!medicamento_nome || !medicamento_concentracao) {
    res.status(400).json({ error: "medicamento_nome e medicamento_concentracao são obrigatórios" });
    return;
  }
  if (isNaN(consumo_diario) || consumo_diario < 0) {
    res.status(400).json({ error: "consumo_diario deve ser um número não negativo" });
    return;
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
        "SELECT paciente_id, consumo_diario FROM paciente_medicamentos WHERE medicamento_nome = ? AND medicamento_concentracao = ?",
        [medicamento_nome, medicamento_concentracao],
        (errPac: Error | null, pacRows: unknown) => {
          if (errPac) {
            console.error("Erro ao buscar vínculos:", errPac);
            res.status(500).json({ error: "Erro ao calcular impacto" });
            return;
          }
          const rows = (pacRows as { paciente_id: number; consumo_diario: number }[]) || [];
          const consumoDiarioAtual = rows.reduce((s, p) => s + Number(p.consumo_diario ?? 0), 0);
          const pacientesVinculados = new Set(rows.map((p) => p.paciente_id)).size;
          const consumoDiarioComNovo = consumoDiarioAtual + consumo_diario;
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
    "SELECT medicamento_nome, medicamento_concentracao, COUNT(DISTINCT paciente_id) AS qtd_pacientes, SUM(consumo_diario) AS consumo_diario_total FROM paciente_medicamentos GROUP BY medicamento_nome, medicamento_concentracao",
    [],
    (errPac: Error | null, pacRows: unknown) => {
      if (errPac) {
        console.error("Erro ao buscar resumo pacientes:", errPac);
        res.status(500).json({ error: "Erro ao buscar resumo" });
        return;
      }
      const grupos = (pacRows as { medicamento_nome: string; medicamento_concentracao: string; qtd_pacientes: number; consumo_diario_total: number }[]) || [];
      if (grupos.length === 0) {
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
      }> = [];
      let processados = 0;
      grupos.forEach((g) => {
        db.query(
          "SELECT COALESCE(SUM(quantidade), 0) AS total FROM medications WHERE nome = ? AND concentracao = ?",
          [g.medicamento_nome, g.medicamento_concentracao],
          (errEst: Error | null, estRows: unknown) => {
            const estoqueTotal = Number((estRows as { total: number }[])?.[0]?.total ?? 0);
            const consumo = Number(g.consumo_diario_total ?? 0);
            const mesesEstoque =
              consumo > 0 && estoqueTotal > 0
                ? Math.floor(estoqueTotal / (consumo * 30))
                : consumo === 0 && estoqueTotal > 0
                  ? null
                  : 0;
            resultados.push({
              medicamento_nome: g.medicamento_nome,
              medicamento_concentracao: g.medicamento_concentracao,
              qtdPacientes: Number(g.qtd_pacientes),
              consumoDiarioTotal: consumo,
              estoqueTotal,
              mesesEstoque,
            });
            processados += 1;
            if (processados === grupos.length) {
              resultados.sort((a, b) => a.medicamento_nome.localeCompare(b.medicamento_nome) || a.medicamento_concentracao.localeCompare(b.medicamento_concentracao));
              res.status(200).json(resultados);
            }
          }
        );
      });
    }
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
