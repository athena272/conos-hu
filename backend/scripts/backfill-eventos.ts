/**
 * Backfill mínimo de eventos a partir de dados históricos.
 *
 * Fontes:
 * - retira_medications → medication.withdraw
 * - movimentacoes (tipo=entrada) → medication.add_quantity
 *
 * Saídas em movimentacoes NÃO são importadas (evita duplicar retiradas).
 *
 * Idempotente: marca detalhes.backfill_source + backfill_source_id.
 *
 * Uso:
 *   npx tsx --import ./load-env.ts scripts/backfill-eventos.ts          # dry-run (padrão)
 *   npx tsx --import ./load-env.ts scripts/backfill-eventos.ts --apply  # grava de fato
 */
import { coll, connectMongo, disconnectMongo } from "../models/mongo";
import { getNextId } from "../models/sequences";
import type { EventoDoc } from "../types/evento";

type MedicationDoc = {
  _id: number;
  nome?: string;
  lote?: string;
  concentracao?: string;
};

type PacienteDoc = {
  _id: number;
  nome?: string;
};

type RetiraDoc = {
  _id: number;
  medication_id: number;
  usuario_id: number;
  quantidade: number;
  data_retirada: Date | string;
  paciente_id: number | null;
};

type MovimentacaoDoc = {
  _id: number;
  tipo: string;
  medication_id: number;
  quantidade: number;
  usuario_id: number | null;
  data_movimentacao: Date | string;
};

type UsuarioDoc = { _id: number; role?: string };

function toDate(value: Date | string | undefined | null): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function hasApplyFlag(argv: string[]): boolean {
  return argv.includes("--apply");
}

async function alreadyBackfilled(
  source: "retira_medications" | "movimentacoes",
  sourceId: number
): Promise<boolean> {
  const existing = await coll<EventoDoc>("eventos").findOne({
    "detalhes.backfill_source": source,
    "detalhes.backfill_source_id": sourceId,
  });
  return Boolean(existing);
}

async function resolveFallbackUsuarioId(): Promise<number | null> {
  const admin = await coll<UsuarioDoc>("usuarios").findOne({ role: "admin" });
  if (admin) return admin._id;
  const any = await coll<UsuarioDoc>("usuarios").findOne({});
  return any?._id ?? null;
}

async function insertEvento(doc: Omit<EventoDoc, "_id">, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  const id = await getNextId("eventos");
  await coll<EventoDoc>("eventos").insertOne({ _id: id, ...doc });
}

export async function backfillRetiras(opts: {
  dryRun: boolean;
  medById: Map<number, MedicationDoc>;
  pacienteById: Map<number, PacienteDoc>;
}): Promise<{ imported: number; skipped: number }> {
  const retiras = await coll<RetiraDoc>("retira_medications").find().sort({ _id: 1 }).toArray();
  let imported = 0;
  let skipped = 0;

  for (const r of retiras) {
    if (await alreadyBackfilled("retira_medications", r._id)) {
      skipped += 1;
      continue;
    }
    if (!Number.isFinite(r.usuario_id) || r.usuario_id < 1) {
      console.warn(`  [skip] retira #${r._id}: usuario_id inválido`);
      skipped += 1;
      continue;
    }

    const med = opts.medById.get(r.medication_id);
    const paciente =
      r.paciente_id != null ? opts.pacienteById.get(r.paciente_id) : undefined;

    await insertEvento(
      {
        acao: "medication.withdraw",
        entidade_tipo: "medication",
        entidade_id: r.medication_id,
        usuario_id: r.usuario_id,
        created_at: toDate(r.data_retirada),
        detalhes: {
          medication_id: r.medication_id,
          nome: med?.nome ?? "",
          lote: med?.lote ?? "",
          quantidade: r.quantidade,
          ...(r.paciente_id != null
            ? {
                paciente_id: r.paciente_id,
                paciente_nome: paciente?.nome ?? "",
              }
            : {}),
          backfill: true,
          backfill_source: "retira_medications",
          backfill_source_id: r._id,
        },
      },
      opts.dryRun
    );
    imported += 1;
  }

  return { imported, skipped };
}

export async function backfillEntradas(opts: {
  dryRun: boolean;
  medById: Map<number, MedicationDoc>;
  fallbackUsuarioId: number | null;
}): Promise<{ imported: number; skipped: number }> {
  const movs = await coll<MovimentacaoDoc>("movimentacoes")
    .find({ tipo: "entrada" })
    .sort({ _id: 1 })
    .toArray();
  let imported = 0;
  let skipped = 0;

  for (const m of movs) {
    if (await alreadyBackfilled("movimentacoes", m._id)) {
      skipped += 1;
      continue;
    }

    let usuario_id = m.usuario_id;
    let responsavelDesconhecido = false;
    if (usuario_id == null || !Number.isFinite(usuario_id) || usuario_id < 1) {
      if (opts.fallbackUsuarioId == null) {
        console.warn(`  [skip] movimentacao #${m._id}: sem usuario_id e sem fallback`);
        skipped += 1;
        continue;
      }
      usuario_id = opts.fallbackUsuarioId;
      responsavelDesconhecido = true;
    }

    const med = opts.medById.get(m.medication_id);

    await insertEvento(
      {
        acao: "medication.add_quantity",
        entidade_tipo: "medication",
        entidade_id: m.medication_id,
        usuario_id,
        created_at: toDate(m.data_movimentacao),
        detalhes: {
          medication_id: m.medication_id,
          nome: med?.nome ?? "",
          lote: med?.lote ?? "",
          quantidade: m.quantidade,
          ...(responsavelDesconhecido ? { responsavel_desconhecido: true } : {}),
          backfill: true,
          backfill_source: "movimentacoes",
          backfill_source_id: m._id,
        },
      },
      opts.dryRun
    );
    imported += 1;
  }

  return { imported, skipped };
}

async function main(): Promise<void> {
  const dryRun = !hasApplyFlag(process.argv);
  console.log(
    dryRun
      ? "Backfill de eventos (DRY-RUN — nada será gravado). Use --apply para persistir."
      : "Backfill de eventos (APPLY — gravando no MongoDB)..."
  );

  await connectMongo();

  const meds = await coll<MedicationDoc>("medications").find().toArray();
  const pacientes = await coll<PacienteDoc>("pacientes").find().toArray();
  const medById = new Map(meds.map((m) => [m._id, m]));
  const pacienteById = new Map(pacientes.map((p) => [p._id, p]));
  const fallbackUsuarioId = await resolveFallbackUsuarioId();

  console.log(`Medicamentos em cache: ${medById.size}`);
  console.log(`Pacientes em cache: ${pacienteById.size}`);
  console.log(`Fallback de usuário (entradas sem responsável): ${fallbackUsuarioId ?? "nenhum"}`);

  console.log("\n→ Importando retira_medications...");
  const retiras = await backfillRetiras({ dryRun, medById, pacienteById });
  console.log(`  importados: ${retiras.imported}, ignorados: ${retiras.skipped}`);

  console.log("\n→ Importando movimentacoes (entrada)...");
  const entradas = await backfillEntradas({ dryRun, medById, fallbackUsuarioId });
  console.log(`  importados: ${entradas.imported}, ignorados: ${entradas.skipped}`);

  console.log(
    `\nConcluído. Total a ${dryRun ? "importar" : "importado"}: ${retiras.imported + entradas.imported}`
  );

  await disconnectMongo();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectMongo();
  process.exit(1);
});
