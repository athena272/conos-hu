import { Request, Response } from "express";
import db from "../models/db";

const TIPOS_RETORNO = ["farmacia_medico", "somente_farmacia", "farmacia_enfermagem"] as const;

interface PacienteRow {
  id: number;
  nome: string;
  prontuario: number;
  apac: string;
  diagnostico: string;
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  observacoes: string | null;
  telefone: string;
  data_liberacao: string;
  retorna_servico: number;
  tipo_retorno: string | null;
}

function validateBodyCreateUpdate(body: Record<string, unknown>, isUpdate: boolean): string | null {
  const { nome, prontuario, apac, diagnostico, medicamento_nome, medicamento_concentracao, consumo_diario, telefone, data_liberacao, retorna_servico, tipo_retorno } = body;
  if (!nome || typeof nome !== "string" || !nome.trim()) return "nome é obrigatório";
  if (prontuario === undefined || prontuario === null) return "prontuario é obrigatório";
  const prontNum = Number(prontuario);
  if (!Number.isInteger(prontNum) || prontNum < 0) return "prontuario deve ser um número inteiro não negativo";
  if (!apac || typeof apac !== "string" || !apac.trim()) return "apac é obrigatório";
  if (!diagnostico || typeof diagnostico !== "string" || !diagnostico.trim()) return "diagnostico é obrigatório";
  if (!medicamento_nome || typeof medicamento_nome !== "string" || !medicamento_nome.trim()) return "medicamento_nome é obrigatório";
  if (!medicamento_concentracao || typeof medicamento_concentracao !== "string" || !medicamento_concentracao.trim()) return "medicamento_concentracao é obrigatório";
  const consumo = Number(consumo_diario);
  if (consumo === undefined || consumo === null || isNaN(consumo) || consumo <= 0) return "consumo_diario deve ser um número maior que zero";
  if (telefone !== undefined && telefone !== null && typeof telefone !== "string") return "telefone deve ser texto quando informado";
  if (!data_liberacao || typeof data_liberacao !== "string" || !data_liberacao.trim()) return "data_liberacao é obrigatória";
  const retorna = Boolean(retorna_servico);
  if (retorna && (!tipo_retorno || typeof tipo_retorno !== "string" || !TIPOS_RETORNO.includes(tipo_retorno as typeof TIPOS_RETORNO[number]))) {
    return "tipo_retorno deve ser um de: farmacia_medico, somente_farmacia, farmacia_enfermagem quando retorna_servico é true";
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
    res.status(200).json((results as PacienteRow[]) || []);
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
    res.status(200).json(rows[0]);
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
    medicamento_nome,
    medicamento_concentracao,
    consumo_diario,
    observacoes,
    telefone,
    data_liberacao,
    retorna_servico,
    tipo_retorno,
  } = req.body;
  const prontNum = Number(prontuario);
  const consumoNum = Number(consumo_diario);
  const retorna = Boolean(retorna_servico);
  const tipoRetornoVal = retorna && tipo_retorno ? String(tipo_retorno) : null;

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
        "INSERT INTO pacientes (nome, prontuario, apac, diagnostico, medicamento_nome, medicamento_concentracao, consumo_diario, observacoes, telefone, data_liberacao, retorna_servico, tipo_retorno) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          String(nome).trim(),
          prontNum,
          String(apac).trim(),
          String(diagnostico).trim(),
          String(medicamento_nome).trim(),
          String(medicamento_concentracao).trim(),
          consumoNum,
          observacoes != null && String(observacoes).trim() !== "" ? String(observacoes).trim() : null,
          (telefone != null && typeof telefone === "string" ? String(telefone).trim() : ""),
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
          const insertId = (result as { insertId?: number })?.insertId;
          res.status(201).json({ message: "Paciente cadastrado com sucesso", id: insertId });
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
    medicamento_nome,
    medicamento_concentracao,
    consumo_diario,
    observacoes,
    telefone,
    data_liberacao,
    retorna_servico,
    tipo_retorno,
  } = req.body;
  const prontNum = Number(prontuario);
  const consumoNum = Number(consumo_diario);
  const retorna = Boolean(retorna_servico);
  const tipoRetornoVal = retorna && tipo_retorno ? String(tipo_retorno) : null;

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
        "UPDATE pacientes SET nome = ?, prontuario = ?, apac = ?, diagnostico = ?, medicamento_nome = ?, medicamento_concentracao = ?, consumo_diario = ?, observacoes = ?, telefone = ?, data_liberacao = ?, retorna_servico = ?, tipo_retorno = ? WHERE id = ?",
        [
          String(nome).trim(),
          prontNum,
          String(apac).trim(),
          String(diagnostico).trim(),
          String(medicamento_nome).trim(),
          String(medicamento_concentracao).trim(),
          consumoNum,
          observacoes != null && String(observacoes).trim() !== "" ? String(observacoes).trim() : null,
          (telefone != null && typeof telefone === "string" ? String(telefone).trim() : ""),
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
          res.status(200).json({ message: "Paciente atualizado com sucesso" });
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
        "SELECT id, consumo_diario FROM pacientes WHERE medicamento_nome = ? AND medicamento_concentracao = ?",
        [medicamento_nome, medicamento_concentracao],
        (errPac: Error | null, pacRows: unknown) => {
          if (errPac) {
            console.error("Erro ao buscar pacientes:", errPac);
            res.status(500).json({ error: "Erro ao calcular impacto" });
            return;
          }
          const pacientes = (pacRows as { id: number; consumo_diario: number }[]) || [];
          const consumoDiarioAtual = pacientes.reduce((s, p) => s + Number(p.consumo_diario ?? 0), 0);
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
            pacientesVinculados: pacientes.length,
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

/** GET /pacientes/resumo-por-medicamento - para cada par (nome, concentracao) com pacientes: estoque, qtd pacientes, consumo total, meses */
export const getResumoPorMedicamento = (req: Request, res: Response): void => {
  db.query(
    "SELECT medicamento_nome, medicamento_concentracao, COUNT(*) AS qtd_pacientes, SUM(consumo_diario) AS consumo_diario_total FROM pacientes GROUP BY medicamento_nome, medicamento_concentracao",
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
