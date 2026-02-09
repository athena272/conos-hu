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
    (err: Error | null) => {
      if (err) {
        console.error("Erro ao registrar medicação:", err);
        res.status(500).json({ error: "Erro ao registrar a medicação" });
        return;
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
