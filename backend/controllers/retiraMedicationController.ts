import { Request, Response } from "express";
import { coll, getDb } from "../models/mongo";
import { getNextId } from "../models/sequences";

type MedicationStock = { _id: number; quantidade: number };

export const retiraMedication = async (req: Request, res: Response): Promise<void> => {
  const usuario_id = req.user!.id;
  const { medication_id, quantidade, paciente_id } = req.body;

  console.log("📥 Dados recebidos para retirada:", { ...req.body, usuario_id });

  const quantidadeNum = parseInt(quantidade, 10);
  const medicationId = parseInt(String(medication_id), 10);

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

  try {
    const db = getDb();

    if (pacienteIdSql != null) {
      const p = await coll<{ _id: number }>("pacientes").findOne({ _id: pacienteIdSql });
      if (!p) {
        res.status(400).json({ error: "Paciente não encontrado" });
        return;
      }
    }

    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const medCol = coll<MedicationStock>("medications");
        const after = await medCol.findOneAndUpdate(
          { _id: medicationId, quantidade: { $gte: quantidadeNum } },
          { $inc: { quantidade: -quantidadeNum } },
          { session, returnDocument: "after" }
        );
        if (!after) {
          const exists = await medCol.findOne({ _id: medicationId }, { session });
          if (!exists) {
            throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
          }
          throw Object.assign(new Error("INSUFFICIENT"), { code: "INSUFFICIENT" });
        }

        const retiraId = await getNextId("retira_medications", session);
        await coll<{
          _id: number;
          medication_id: number;
          usuario_id: number;
          quantidade: number;
          data_retirada: Date;
          paciente_id: number | null;
        }>("retira_medications").insertOne(
          {
            _id: retiraId,
            medication_id: medicationId,
            usuario_id,
            quantidade: quantidadeNum,
            data_retirada: new Date(),
            paciente_id: pacienteIdSql,
          },
          { session }
        );

        const movId = await getNextId("movimentacoes", session);
        await coll<{
          _id: number;
          tipo: string;
          medication_id: number;
          quantidade: number;
          usuario_id: number;
          data_movimentacao: Date;
        }>("movimentacoes").insertOne(
          {
            _id: movId,
            tipo: "saida",
            medication_id: medicationId,
            quantidade: quantidadeNum,
            usuario_id,
            data_movimentacao: new Date(),
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    console.log("✅ Retirada realizada com sucesso");
    res.status(200).json({ message: "Retirada realizada com sucesso" });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "NOT_FOUND") {
      console.error("❌ Medicação não encontrada, ID:", medication_id);
      res.status(404).json({ error: "Medicação não encontrada" });
      return;
    }
    if (e.code === "INSUFFICIENT") {
      console.log("❌ Quantidade insuficiente em estoque");
      res.status(400).json({ error: "Quantidade insuficiente em estoque" });
      return;
    }
    console.error("❌ Erro na retirada:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
