/**
 * Copia dados de um MySQL (ex.: dump restaurado localmente) para MongoDB Atlas.
 *
 * Variáveis de ambiente:
 * - MONGODB_URI (obrigatório)
 * - SOURCE_MYSQL_HOST, SOURCE_MYSQL_PORT, SOURCE_MYSQL_USER, SOURCE_MYSQL_PASSWORD, SOURCE_MYSQL_DATABASE
 * - MYSQL_TO_MONGO_CLEAR=1 para apagar as coleções alvo antes de importar (recomendado na primeira carga)
 *
 * Uso: pnpm exec tsx scripts/mysql-to-mongo.ts
 */

import { MongoClient, type Collection, type Db } from "mongodb";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

function typedColl<T extends object>(dbc: Db, name: string): Collection<T> {
  return dbc.collection(name) as unknown as Collection<T>;
}

function dateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v).slice(0, 10);
}

function tsVal(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("Defina MONGODB_URI");
    process.exit(1);
  }

  const host = process.env.SOURCE_MYSQL_HOST || "127.0.0.1";
  const port = parseInt(process.env.SOURCE_MYSQL_PORT || "3306", 10);
  const user = process.env.SOURCE_MYSQL_USER || "root";
  const password = process.env.SOURCE_MYSQL_PASSWORD ?? "";
  const database = process.env.SOURCE_MYSQL_DATABASE || "conos";

  const sql = await mysql.createConnection({ host, port, user, password, database });
  const mongo = new MongoClient(uri);
  await mongo.connect();
  const db = mongo.db();

  const clear = process.env.MYSQL_TO_MONGO_CLEAR === "1";
  if (clear) {
    console.log("Limpando coleções no MongoDB...");
    for (const n of [
      "movimentacoes",
      "retira_medications",
      "paciente_medicamentos",
      "paciente_retornos",
      "pacientes",
      "medications",
      "usuarios",
      "medication_product_catalog",
      "counters",
    ]) {
      await typedColl<Record<string, unknown>>(db, n).deleteMany({});
    }
  }

  console.log("Lendo usuarios...");
  const [usuarios] = await sql.query<RowDataPacket[]>("SELECT * FROM usuarios");
  if (usuarios.length) {
    await typedColl<{
      _id: number;
      email: string;
      password: string;
      role: string;
      created_at: Date;
    }>(db, "usuarios").insertMany(
      usuarios.map((r) => ({
        _id: r.idusuarios as number,
        email: r.email,
        password: r.password,
        role: r.role,
        created_at: tsVal(r.created_at),
      }))
    );
  }

  console.log("Lendo medications...");
  const [meds] = await sql.query<RowDataPacket[]>("SELECT * FROM medications");
  if (meds.length) {
    await typedColl<Record<string, unknown> & { _id: number }>(db, "medications").insertMany(
      meds.map((r) => ({
        _id: r.id as number,
        nome: r.nome,
        lote: r.lote,
        quantidade: Number(r.quantidade),
        classificacao: r.classificacao ?? null,
        concentracao: r.concentracao,
        forma: String(r.forma),
        data_validade: dateStr(r.data_validade),
        created_at: r.created_at != null ? tsVal(r.created_at) : undefined,
      }))
    );
  }

  console.log("Lendo movimentacoes...");
  const [movs] = await sql.query<RowDataPacket[]>("SELECT * FROM movimentacoes");
  if (movs.length) {
    await typedColl<Record<string, unknown> & { _id: number }>(db, "movimentacoes").insertMany(
      movs.map((r) => ({
        _id: r.id as number,
        tipo: r.tipo,
        medication_id: r.medication_id,
        quantidade: Number(r.quantidade),
        usuario_id: r.usuario_id != null ? Number(r.usuario_id) : null,
        data_movimentacao: tsVal(r.data_movimentacao),
      }))
    );
  }

  console.log("Lendo retira_medications...");
  const [retiras] = await sql.query<RowDataPacket[]>("SELECT * FROM retira_medications");
  if (retiras.length) {
    await typedColl<Record<string, unknown> & { _id: number }>(db, "retira_medications").insertMany(
      retiras.map((r) => ({
        _id: r.id as number,
        medication_id: r.medication_id,
        usuario_id: r.usuario_id,
        quantidade: Number(r.quantidade),
        data_retirada: tsVal(r.data_retirada),
        paciente_id: r.paciente_id != null ? Number(r.paciente_id) : null,
      }))
    );
  }

  console.log("Lendo pacientes...");
  const [pacs] = await sql.query<RowDataPacket[]>("SELECT * FROM pacientes");
  if (pacs.length) {
    await typedColl<Record<string, unknown> & { _id: number }>(db, "pacientes").insertMany(
      pacs.map((r) => ({
        _id: r.id as number,
        nome: r.nome,
        prontuario: Number(r.prontuario),
        apac: r.apac,
        diagnostico: r.diagnostico,
        observacoes: r.observacoes ?? null,
        telefone: r.telefone ?? "",
        data_liberacao: dateStr(r.data_liberacao),
        retorna_servico: Number(r.retorna_servico) ? 1 : 0,
        tipo_retorno: r.tipo_retorno ?? null,
      }))
    );
  }

  console.log("Lendo paciente_medicamentos...");
  const [pms] = await sql.query<RowDataPacket[]>("SELECT * FROM paciente_medicamentos");
  if (pms.length) {
    await typedColl<Record<string, unknown> & { _id: number }>(db, "paciente_medicamentos").insertMany(
      pms.map((r) => ({
        _id: r.id as number,
        paciente_id: r.paciente_id,
        medicamento_nome: r.medicamento_nome,
        medicamento_concentracao: r.medicamento_concentracao,
        consumo_diario: Number(r.consumo_diario),
        regime_consumo: r.regime_consumo,
        unidades_por_ciclo: r.unidades_por_ciclo != null ? Number(r.unidades_por_ciclo) : null,
        intervalo_ciclo_dias: r.intervalo_ciclo_dias != null ? Number(r.intervalo_ciclo_dias) : null,
      }))
    );
  }

  console.log("Lendo paciente_retornos...");
  const [prs] = await sql.query<RowDataPacket[]>("SELECT * FROM paciente_retornos");
  if (prs.length) {
    await typedColl<Record<string, unknown> & { _id: number }>(db, "paciente_retornos").insertMany(
      prs.map((r) => ({
        _id: r.id as number,
        paciente_id: r.paciente_id,
        data_retorno: dateStr(r.data_retorno),
        tipo_retorno: r.tipo_retorno ?? null,
        created_at: tsVal(r.created_at),
      }))
    );
  }

  try {
    const [cat] = await sql.query<RowDataPacket[]>("SELECT * FROM medication_product_catalog");
    if (cat.length) {
      console.log("Lendo medication_product_catalog...");
      await typedColl<Record<string, unknown> & { _id: number }>(db, "medication_product_catalog").insertMany(
        cat.map((r) => ({
          _id: r.id as number,
          gtin: String(r.gtin),
          nome: r.nome ?? null,
          concentracao: r.concentracao ?? null,
          forma: r.forma != null ? String(r.forma) : null,
          classificacao: r.classificacao != null ? String(r.classificacao) : null,
          created_at: r.created_at != null ? tsVal(r.created_at) : undefined,
          updated_at: r.updated_at != null ? tsVal(r.updated_at) : undefined,
        }))
      );
    }
  } catch {
    console.log("(medication_product_catalog não existe ou vazio — ignorado)");
  }

  async function nextSeq(collectionName: string): Promise<number> {
    const agg = await typedColl<{ _id: number }>(db, collectionName)
      .aggregate([{ $group: { _id: null, m: { $max: "$_id" } } }])
      .toArray();
    const max = agg[0]?.m != null ? Number(agg[0].m) : 0;
    return max + 1;
  }

  const counterKeys = [
    "usuarios",
    "medications",
    "movimentacoes",
    "retira_medications",
    "pacientes",
    "paciente_medicamentos",
    "paciente_retornos",
    "medication_product_catalog",
  ] as const;

  console.log("Atualizando counters...");
  for (const key of counterKeys) {
    const seq = await nextSeq(key);
    await typedColl<{ _id: string; seq: number }>(db, "counters").updateOne({ _id: key }, { $set: { seq } }, { upsert: true });
  }

  await sql.end();
  await mongo.close();
  console.log("✅ Migração concluída.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
