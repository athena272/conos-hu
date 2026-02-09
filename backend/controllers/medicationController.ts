import { Request, Response } from "express";
import db from "../models/db";

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

export const registerMedication = (req: Request, res: Response): void => {
  const {
    nome,
    lote,
    quantidade,
    classificacao,
    concentracao,
    forma,
    data_validade,
  } = req.body;

  if (!nome || !lote || !quantidade || !data_validade) {
    res.status(400).json({ error: "Todos os campos são obrigatórios" });
    return;
  }

  db.query(
    "INSERT INTO medications (nome, lote, quantidade, classificacao, concentracao, forma, data_validade) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [nome, lote, quantidade, classificacao, concentracao, forma, data_validade],
    (err: Error | null, result: unknown) => {
      if (err) {
        console.error("Erro ao registrar medicação:", err);
        res.status(500).json({ error: "Erro ao registrar a medicação" });
        return;
      }
      const medicationId = (result as { insertId?: number })?.insertId;
      if (medicationId) {
        db.query(
          "INSERT INTO movimentacoes (tipo, medication_id, quantidade, usuario_id) VALUES ('entrada', ?, ?, NULL)",
          [medicationId, quantidade],
          (movErr: Error | null) => {
            if (movErr) console.error("Erro ao registrar movimentação de entrada:", movErr);
          }
        );
      }
      res.status(201).json({ message: "Medicação registrada com sucesso" });
    }
  );
};

export const getMedications = (req: Request, res: Response): void => {
  db.query("SELECT * FROM medications", (err: Error | null, result: MedicationRow[]) => {
    if (err) {
      console.error("Erro ao buscar medicações:", err);
      res.status(500).json({ error: "Erro ao buscar medicações" });
      return;
    }

    const hoje = new Date();

    const medicationsWithStatus = result.map((med) => {
      const validade = new Date(med.data_validade);
      let status: string;

      if (med.quantidade <= 0) {
        status = "emFalta";
      } else if (validade < hoje) {
        status = "foraValidade";
      } else if ((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= 90) {
        status = "proximoVencer";
      } else {
        status = "emEstoque";
      }

      return {
        ...med,
        status,
      };
    });

    res.status(200).json(medicationsWithStatus);
  });
};

export const getValidade = (req: Request, res: Response): void => {
  db.query(
    "SELECT * FROM medications WHERE data_validade < CURDATE()",
    (err: Error | null, result: unknown) => {
      if (err) {
        console.error("Erro ao buscar medicações vencidas:", err);
        res.status(500).json({ error: "Erro ao buscar medicações vencidas" });
        return;
      }
      res.status(200).json((result as MedicationRow[]) || []);
    }
  );
};

export const getQuantity = (req: Request, res: Response): void => {
  db.query(
    "SELECT SUM(quantidade) AS total FROM medications",
    (err: Error | null, result: { total: number }[]) => {
      if (err) {
        console.error("Erro ao buscar a quantidade de medicações", err);
        res.status(500).json({ error: "Erro ao buscar a quantidade de medicações" });
        return;
      }
      res.status(200).json({ total: result[0]?.total || 0 });
    }
  );
};

export const searchMedication = (req: Request, res: Response): void => {
  const { nome, concentracao } = req.body;

  if (!nome || !concentracao) {
    res.status(400).json({ error: "Nome e concentração são obrigatórios" });
    return;
  }

  db.query(
    "SELECT * FROM medications WHERE nome = ? AND concentracao = ? LIMIT 1",
    [nome, concentracao],
    (err: Error | null, results: unknown) => {
      if (err) {
        console.error("Erro ao buscar medicação:", err);
        res.status(500).json({ error: "Erro ao buscar medicação" });
        return;
      }

      const rows = (results as MedicationRow[]) || [];
      if (rows.length === 0) {
        res.status(404).json({ error: "Medicação não encontrada" });
        return;
      }

      res.status(200).json(rows[0]);
    }
  );
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

export const getMedicationById = (req: Request, res: Response): void => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  db.query(
    "SELECT * FROM medications WHERE id = ?",
    [id],
    (err: Error | null, results: unknown) => {
      if (err) {
        console.error("Erro ao buscar medicação:", err);
        res.status(500).json({ error: "Erro ao buscar medicação" });
        return;
      }
      const rows = (results as MedicationRow[]) || [];
      if (rows.length === 0) {
        res.status(404).json({ error: "Medicação não encontrada" });
        return;
      }
      res.status(200).json(addStatus(rows[0]));
    }
  );
};

/** Lista todos os lotes (medicamentos) com mesmo nome e concentração para escolha na retirada */
export const getLotsByNameConcentration = (req: Request, res: Response): void => {
  const nome = req.query.nome as string;
  const concentracao = req.query.concentracao as string;

  if (!nome?.trim() || !concentracao?.trim()) {
    res.status(400).json({ error: "Nome e concentração são obrigatórios" });
    return;
  }

  db.query(
    "SELECT * FROM medications WHERE nome = ? AND concentracao = ? ORDER BY data_validade ASC",
    [nome.trim(), concentracao.trim()],
    (err: Error | null, results: unknown) => {
      if (err) {
        console.error("Erro ao buscar lotes:", err);
        res.status(500).json({ error: "Erro ao buscar lotes" });
        return;
      }
      const rows = (results as MedicationRow[]) || [];
      res.status(200).json(rows.map(addStatus));
    }
  );
};

export const addQuantity = (req: Request, res: Response): void => {
  const { medication_id, quantidade } = req.body;
  const quantidadeNum = parseInt(quantidade, 10);

  if (!medication_id || isNaN(quantidadeNum) || quantidadeNum <= 0) {
    res.status(400).json({ error: "medication_id e quantidade (número positivo) são obrigatórios" });
    return;
  }

  db.query(
    "SELECT id, quantidade FROM medications WHERE id = ?",
    [medication_id],
    (err: Error | null, rows: unknown) => {
      if (err) {
        console.error("Erro ao buscar medicação:", err);
        res.status(500).json({ error: "Erro ao buscar medicação" });
        return;
      }
      const list = (rows as MedicationRow[]) || [];
      if (list.length === 0) {
        res.status(404).json({ error: "Medicação não encontrada" });
        return;
      }

      db.query(
        "UPDATE medications SET quantidade = quantidade + ? WHERE id = ?",
        [quantidadeNum, medication_id],
        (upErr: Error | null) => {
          if (upErr) {
            console.error("Erro ao adicionar quantidade:", upErr);
            res.status(500).json({ error: "Erro ao adicionar quantidade" });
            return;
          }
          db.query(
            "INSERT INTO movimentacoes (tipo, medication_id, quantidade, usuario_id) VALUES ('entrada', ?, ?, NULL)",
            [medication_id, quantidadeNum],
            (movErr: Error | null) => {
              if (movErr) console.error("Erro ao registrar movimentação de entrada:", movErr);
            }
          );
          res.status(200).json({ message: "Quantidade adicionada com sucesso" });
        }
      );
    }
  );
};

export const updateMedication = (req: Request, res: Response): void => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const {
    nome,
    lote,
    quantidade,
    classificacao,
    concentracao,
    forma,
    data_validade,
  } = req.body;

  if (!nome || !lote || quantidade === undefined || quantidade === null || !data_validade) {
    res.status(400).json({ error: "nome, lote, quantidade e data_validade são obrigatórios" });
    return;
  }

  const quantidadeNum = parseInt(quantidade, 10);
  if (isNaN(quantidadeNum) || quantidadeNum < 0) {
    res.status(400).json({ error: "quantidade deve ser um número não negativo" });
    return;
  }

  db.query(
    "UPDATE medications SET nome = ?, lote = ?, quantidade = ?, classificacao = ?, concentracao = ?, forma = ?, data_validade = ? WHERE id = ?",
    [nome, lote, quantidadeNum, classificacao ?? "", concentracao ?? "", forma, data_validade, id],
    (err: Error | null, result: unknown) => {
      if (err) {
        console.error("Erro ao atualizar medicação:", err);
        res.status(500).json({ error: "Erro ao atualizar medicação" });
        return;
      }
      if ((result as { affectedRows?: number })?.affectedRows === 0) {
        res.status(404).json({ error: "Medicação não encontrada" });
        return;
      }
      db.query(
        "SELECT * FROM medications WHERE id = ?",
        [id],
        (selErr: Error | null, rows: unknown) => {
          if (selErr || !(rows as MedicationRow[]).length) {
            res.status(200).json({ message: "Medicação atualizada com sucesso" });
            return;
          }
          res.status(200).json(addStatus((rows as MedicationRow[])[0]));
        }
      );
    }
  );
};
