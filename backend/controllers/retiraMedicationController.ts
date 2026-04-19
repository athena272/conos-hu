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
  const usuario_id = req.user!.id;
  const { medication_id, quantidade, paciente_id } = req.body;

  console.log("📥 Dados recebidos para retirada:", { ...req.body, usuario_id });

  const quantidadeNum = parseInt(quantidade, 10);

  if (!medication_id || isNaN(quantidadeNum)) {
    console.log("❌ Dados inválidos:", { medication_id, quantidade });
    res.status(400).json({
      error: "medication_id e quantidade numérica são obrigatórios",
    });
    return;
  }

  let pacienteIdSql: number | null = null;
  if (paciente_id != null && paciente_id !== "") {
    const pid = parseInt(String(paciente_id), 10);
    if (isNaN(pid) || pid < 1) {
      res.status(400).json({ error: "paciente_id inválido" });
      return;
    }
    pacienteIdSql = pid;
  }

  db.getConnection((err: Error | null, connection: PoolConnection) => {
    if (err) {
      console.error("❌ Erro ao obter conexão:", err);
      res.status(500).json({ error: "Erro interno do servidor" });
      return;
    }

    const runTransaction = (): void => {
      connection.beginTransaction((txErr) => {
        if (txErr) {
          connection.release();
          console.error("❌ Erro ao iniciar transação:", txErr);
          res.status(500).json({ error: "Erro interno do servidor" });
          return;
        }

        console.log("🔍 Verificando estoque para medication_id:", medication_id);

        connection.query(
          "SELECT quantidade FROM medications WHERE id = ? FOR UPDATE",
          [medication_id],
          (selErr: Error | null, result: unknown) => {
            if (selErr) {
              connection.rollback(() => connection.release());
              console.error("❌ Erro ao buscar medicação:", selErr);
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
              "INSERT INTO retira_medications (medication_id, usuario_id, quantidade, paciente_id) VALUES (?, ?, ?, ?)",
              [medication_id, usuario_id, quantidadeNum, pacienteIdSql],
              (insErr) => {
                if (insErr) {
                  connection.rollback(() => connection.release());
                  console.error("❌ Erro ao registrar retirada:", insErr);
                  res.status(500).json({ error: "Erro ao registrar retirada" });
                  return;
                }

                connection.query(
                  "INSERT INTO movimentacoes (tipo, medication_id, quantidade, usuario_id) VALUES ('saida', ?, ?, ?)",
                  [medication_id, quantidadeNum, usuario_id],
                  (movErr) => {
                    if (movErr) {
                      connection.rollback(() => connection.release());
                      console.error("❌ Erro ao registrar movimentação:", movErr);
                      res.status(500).json({ error: "Erro ao registrar movimentação" });
                      return;
                    }

                    console.log("🔄 Atualizando estoque...");
                    connection.query(
                      "UPDATE medications SET quantidade = quantidade - ? WHERE id = ?",
                      [quantidadeNum, medication_id],
                      (updErr) => {
                        if (updErr) {
                          connection.rollback(() => connection.release());
                          console.error("❌ Erro ao atualizar estoque:", updErr);
                          res.status(500).json({ error: "Erro ao atualizar estoque" });
                          return;
                        }

                        connection.commit((commitErr) => {
                          if (commitErr) {
                            connection.rollback(() => connection.release());
                            console.error("❌ Erro ao finalizar transação:", commitErr);
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
          }
        );
      });
    };

    if (pacienteIdSql != null) {
      connection.query(
        "SELECT id FROM pacientes WHERE id = ?",
        [pacienteIdSql],
        (chkErr: Error | null, chkResult: unknown) => {
          if (chkErr) {
            connection.release();
            console.error("❌ Erro ao validar paciente:", chkErr);
            res.status(500).json({ error: "Erro ao validar paciente" });
            return;
          }
          const prow = (chkResult as { id: number }[]) || [];
          if (prow.length === 0) {
            connection.release();
            res.status(400).json({ error: "Paciente não encontrado" });
            return;
          }
          runTransaction();
        }
      );
    } else {
      runTransaction();
    }
  });
};
