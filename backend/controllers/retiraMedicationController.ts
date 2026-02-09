import { Request, Response } from "express";
import db from "../models/db";

interface PoolConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, result?: unknown) => void
  ) => void;
  beginTransaction: (callback: (err: Error | null) => void) => void;
  commit: (callback: (err: Error | null) => void) => void;
  rollback: (callback: () => void) => void;
  release: () => void;
}

export const retiraMedication = (req: Request, res: Response): void => {
  const { medication_id, usuario_id, quantidade } = req.body;

  console.log("📥 Dados recebidos para retirada:", req.body);

  const quantidadeNum = parseInt(quantidade);

  if (!medication_id || !usuario_id || isNaN(quantidadeNum)) {
    console.log("❌ Dados inválidos:", { medication_id, usuario_id, quantidade });
    res.status(400).json({
      error: "Todos os campos são obrigatórios e quantidade deve ser numérica",
    });
    return;
  }

  db.getConnection((err: Error | null, connection: PoolConnection) => {
    if (err) {
      console.error("❌ Erro ao obter conexão:", err);
      res.status(500).json({ error: "Erro interno do servidor" });
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("❌ Erro ao iniciar transação:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
        return;
      }

      console.log("🔍 Verificando estoque para medication_id:", medication_id);

      connection.query(
        "SELECT quantidade FROM medications WHERE id = ? FOR UPDATE",
        [medication_id],
        (err: Error | null, result: unknown) => {
          if (err) {
            connection.rollback(() => connection.release());
            console.error("❌ Erro ao buscar medicação:", err);
            res.status(500).json({ error: "Erro ao buscar medicação" });
            return;
          }

          const rows = (result as { quantidade: number }[]) || [];
          if (rows.length === 0) {
            connection.rollback(() => connection.release());
            console.error("❌ Medicação não encontrada, ID:", medication_id);
            res.status(404).json({ error: "Medicação não encontrada" });
            return;
          }

          const availableQuantity = rows[0].quantidade;
          console.log(
            `📊 Estoque disponível: ${availableQuantity}, Quantidade solicitada: ${quantidadeNum}`
          );

          if (availableQuantity < quantidadeNum) {
            connection.rollback(() => connection.release());
            console.log("❌ Quantidade insuficiente em estoque");
            res.status(400).json({ error: "Quantidade insuficiente em estoque" });
            return;
          }

          console.log("📝 Registrando retirada...");
          connection.query(
            "INSERT INTO retira_medications (medication_id, usuario_id, quantidade) VALUES (?, ?, ?)",
            [medication_id, usuario_id, quantidadeNum],
            (err) => {
              if (err) {
                connection.rollback(() => connection.release());
                console.error("❌ Erro ao registrar retirada:", err);
                res.status(500).json({ error: "Erro ao registrar retirada" });
                return;
              }

              console.log("🔄 Atualizando estoque...");
              connection.query(
                "UPDATE medications SET quantidade = quantidade - ? WHERE id = ?",
                [quantidadeNum, medication_id],
                (err) => {
                  if (err) {
                    connection.rollback(() => connection.release());
                    console.error("❌ Erro ao atualizar estoque:", err);
                    res.status(500).json({ error: "Erro ao atualizar estoque" });
                    return;
                  }

                  connection.commit((err) => {
                    if (err) {
                      connection.rollback(() => connection.release());
                      console.error("❌ Erro ao finalizar transação:", err);
                      res.status(500).json({
                        error: "Erro ao finalizar transação",
                      });
                      return;
                    }
                    connection.release();
                    console.log("✅ Retirada realizada com sucesso");
                    res.status(200).json({ message: "Retirada realizada com sucesso" });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};
