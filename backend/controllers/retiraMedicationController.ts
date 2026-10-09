import { Request, Response } from "express";
import { recordEventFromRequest } from "../utils/auditContext";
import {
  RetiraError,
  executarRetiradas,
  parseRetiraItem,
  parseRetiraItens,
  type RetiradaRealizada,
} from "../services/retiraService";

async function registrarEventosRetirada(req: Request, realizadas: RetiradaRealizada[]): Promise<void> {
  for (const r of realizadas) {
    await recordEventFromRequest(req, {
      acao: "medication.withdraw",
      entidade_tipo: "medication",
      entidade_id: r.medicationId,
      detalhes: {
        medication_id: r.medicationId,
        nome: r.nome,
        lote: r.lote,
        quantidade: r.quantidade,
        ...(r.pacienteId != null
          ? { paciente_id: r.pacienteId, paciente_nome: r.pacienteNome }
          : {}),
      },
    });
  }
}

function responderErroRetirada(
  res: Response,
  err: unknown,
  { incluirItemIndex }: { incluirItemIndex: boolean },
): void {
  if (err instanceof RetiraError) {
    console.log(`❌ Retirada rejeitada: ${err.message}`, err.itemIndex ?? "");
    const body: Record<string, unknown> = { error: err.message };
    if (incluirItemIndex && err.itemIndex != null) body.item_index = err.itemIndex;
    res.status(err.status).json(body);
    return;
  }
  console.error("❌ Erro na retirada:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
}

export const retiraMedication = async (req: Request, res: Response): Promise<void> => {
  const usuario_id = req.user!.id;
  console.log("📥 Dados recebidos para retirada:", { ...req.body, usuario_id });

  try {
    const item = parseRetiraItem(req.body);
    const realizadas = await executarRetiradas(usuario_id, [item]);
    await registrarEventosRetirada(req, realizadas);

    console.log("✅ Retirada realizada com sucesso");
    res.status(200).json({ message: "Retirada realizada com sucesso" });
  } catch (err: unknown) {
    responderErroRetirada(res, err, { incluirItemIndex: false });
  }
};

export const retiraMedicationLote = async (req: Request, res: Response): Promise<void> => {
  const usuario_id = req.user!.id;
  console.log("📥 Dados recebidos para retirada em lote:", { ...req.body, usuario_id });

  try {
    const itens = parseRetiraItens(req.body);
    const realizadas = await executarRetiradas(usuario_id, itens);
    await registrarEventosRetirada(req, realizadas);

    console.log(`✅ Retirada em lote realizada com sucesso (${realizadas.length} itens)`);
    res.status(200).json({
      message: "Retiradas realizadas com sucesso",
      total_itens: realizadas.length,
    });
  } catch (err: unknown) {
    responderErroRetirada(res, err, { incluirItemIndex: true });
  }
};
