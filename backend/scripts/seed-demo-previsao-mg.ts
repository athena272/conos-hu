/**
 * Popula medicamentos e pacientes de demonstração para validar previsão (mg).
 * Uso: npx tsx --import ./load-env.ts scripts/seed-demo-previsao-mg.ts
 */
import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../app";
import { coll, connectMongo, disconnectMongo } from "../models/mongo";
import { getNextId } from "../models/sequences";

const ADMIN_EMAIL = "seed-admin@conos.local";
const ADMIN_PASSWORD = "Seed@12345";

async function ensureAdminToken(): Promise<string> {
  const existing = await coll<{ _id: number; email: string; password: string; role: string }>("usuarios").findOne({
    email: ADMIN_EMAIL,
  });
  if (!existing) {
    const id = await getNextId("usuarios");
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await coll("usuarios").insertOne({
      _id: id,
      email: ADMIN_EMAIL,
      password: hash,
      role: "admin",
      created_at: new Date(),
    });
    console.log(`Admin criado: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }
  const login = await request(app).post("/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (login.status !== 200) throw new Error(`Login falhou: ${JSON.stringify(login.body)}`);
  return login.body.token as string;
}

async function createMedication(
  token: string,
  data: {
    nome: string;
    lote: string;
    quantidade: number;
    classificacao: string;
    concentracao: string;
    forma: string;
    data_validade: string;
  }
): Promise<void> {
  const res = await request(app).post("/medications").set("Authorization", `Bearer ${token}`).send(data);
  if (res.status !== 201) {
    console.warn(`Medicamento ${data.nome} ${data.lote}: ${res.status}`, res.body);
  } else {
    console.log(`+ Medicamento: ${data.nome} ${data.concentracao} lote ${data.lote} (${data.quantidade} un.)`);
  }
}

async function createPaciente(token: string, body: Record<string, unknown>): Promise<number | null> {
  const res = await request(app).post("/pacientes").set("Authorization", `Bearer ${token}`).send(body);
  if (res.status !== 201) {
    console.error(`Paciente ${body.nome}: ${res.status}`, res.body);
    return null;
  }
  console.log(`+ Paciente: ${body.nome} (id ${res.body.id})`);
  return res.body.id as number;
}

async function main(): Promise<void> {
  await connectMongo();

  const token = await ensureAdminToken();

  const meds = [
    { nome: "Paracetamol", lote: "DEMO-PAR-01", quantidade: 800, classificacao: "Analgésico", concentracao: "500mg", forma: "Comprimido", data_validade: "2027-12-31" },
    { nome: "Paracetamol", lote: "DEMO-PAR-02", quantidade: 200, classificacao: "Analgésico", concentracao: "500mg", forma: "Comprimido", data_validade: "2026-06-30" },
    { nome: "Omeprazol", lote: "DEMO-OMZ-01", quantidade: 120, classificacao: "Antiácido", concentracao: "20mg", forma: "Comprimido", data_validade: "2027-08-20" },
    { nome: "Sugamadex", lote: "DEMO-SUG-01", quantidade: 40, classificacao: "Anestesia", concentracao: "100mg/ml", forma: "Injetável", data_validade: "2028-10-31" },
    { nome: "Metformina", lote: "DEMO-MET-01", quantidade: 180, classificacao: "Antidiabético", concentracao: "850mg", forma: "Comprimido", data_validade: "2027-09-01" },
  ];
  for (const m of meds) await createMedication(token, m);

  const pacientes = [
    {
      nome: "Maria Silva",
      prontuario: 200001,
      apac: "APAC-DEMO-001",
      diagnostico: "Dor crônica",
      medicamentos: [{ medicamento_nome: "Paracetamol", medicamento_concentracao: "500mg", consumo_diario: 2, regime_consumo: "diario" }],
      observacoes: "Regime diário: 2 comp/dia → previsão 1.000 mg/dia",
      telefone: "(11) 98765-4321",
      data_liberacao: "2025-01-15",
      retorna_servico: false,
    },
    {
      nome: "João Santos",
      prontuario: 200002,
      apac: "APAC-DEMO-002",
      diagnostico: "Pós-operatório — injetável espaçado",
      medicamentos: [{
        medicamento_nome: "Sugamadex",
        medicamento_concentracao: "100mg/ml",
        consumo_diario: 0,
        regime_consumo: "por_ciclo",
        unidades_por_ciclo: 1,
        intervalo_ciclo_dias: 45,
      }],
      observacoes: "Por ciclo: 1 ampola a cada 45 dias",
      telefone: "(11) 91234-5678",
      data_liberacao: "2025-02-01",
      retorna_servico: true,
      tipo_retorno: "somente_farmacia",
      data_retorno: "2025-04-01",
    },
    {
      nome: "Ana Oliveira",
      prontuario: 200003,
      apac: "APAC-DEMO-003",
      diagnostico: "Esquema oncológico em mg",
      medicamentos: [{
        medicamento_nome: "Metformina",
        medicamento_concentracao: "850mg",
        consumo_diario: 0,
        regime_consumo: "por_miligrama",
        consumo_mg_diario: 1700,
      }],
      observacoes: "Consumo por miligrama: 1.700 mg/dia direto",
      telefone: "(21) 99876-5432",
      data_liberacao: "2025-01-20",
      retorna_servico: false,
    },
    {
      nome: "Pedro Costa",
      prontuario: 200004,
      apac: "APAC-DEMO-004",
      diagnostico: "Refluxo",
      medicamentos: [{ medicamento_nome: "Omeprazol", medicamento_concentracao: "20mg", consumo_diario: 1, regime_consumo: "diario" }],
      observacoes: "1 comp/dia → 20 mg/dia",
      telefone: "(31) 97654-3210",
      data_liberacao: "2025-02-10",
      retorna_servico: false,
    },
    {
      nome: "Helena Souza",
      prontuario: 200005,
      apac: "APAC-DEMO-005",
      diagnostico: "Dor + refluxo (dois medicamentos)",
      medicamentos: [
        { medicamento_nome: "Paracetamol", medicamento_concentracao: "500mg", consumo_diario: 2, regime_consumo: "diario" },
        { medicamento_nome: "Omeprazol", medicamento_concentracao: "20mg", consumo_diario: 1, regime_consumo: "diario" },
      ],
      observacoes: "Dois vínculos no mesmo paciente",
      telefone: "(11) 98888-1111",
      data_liberacao: "2025-02-15",
      retorna_servico: false,
    },
    {
      nome: "Roberto Lima",
      prontuario: 200006,
      apac: "APAC-DEMO-006",
      diagnostico: "Mesmo Paracetamol que Maria (soma no resumo)",
      medicamentos: [{ medicamento_nome: "Paracetamol", medicamento_concentracao: "500mg", consumo_diario: 3, regime_consumo: "diario" }],
      observacoes: "3 comp/dia → 1.500 mg/dia; resumo Paracetamol soma Maria+Roberto",
      telefone: "(11) 95432-1098",
      data_liberacao: "2025-02-05",
      retorna_servico: false,
    },
    {
      nome: "Carla Mendes",
      prontuario: 200007,
      apac: "APAC-DEMO-007",
      diagnostico: "Dois pacientes por ciclo mesmo intervalo (Sugamadex)",
      medicamentos: [{
        medicamento_nome: "Sugamadex",
        medicamento_concentracao: "100mg/ml",
        consumo_diario: 0,
        regime_consumo: "por_ciclo",
        unidades_por_ciclo: 2,
        intervalo_ciclo_dias: 45,
      }],
      observacoes: "2 unid/ciclo a cada 45d — resumo agrega mg/ciclo com João",
      telefone: "(11) 96543-2109",
      data_liberacao: "2025-01-25",
      retorna_servico: false,
    },
  ];

  for (const p of pacientes) await createPaciente(token, p);

  const list = await request(app).get("/pacientes").set("Authorization", `Bearer ${token}`);
  const resumo = await request(app).get("/pacientes/resumo-por-medicamento").set("Authorization", `Bearer ${token}`);

  console.log("\n=== PREVISÃO POR PACIENTE ===");
  for (const p of list.body as Array<{ nome: string; medicamentos: Array<{ medicamento_nome: string; medicamento_concentracao: string; previsao_mg?: Record<string, unknown> }> }>) {
    for (const m of p.medicamentos ?? []) {
      const prev = m.previsao_mg;
      console.log(
        `${p.nome} | ${m.medicamento_nome} ${m.medicamento_concentracao} →`,
        prev ? JSON.stringify(prev) : "sem previsao_mg"
      );
    }
  }

  console.log("\n=== RESUMO COMPROMETIDO ===");
  for (const r of resumo.body as Array<Record<string, unknown>>) {
    console.log(
      `${r.medicamento_nome} ${r.medicamento_concentracao} | estoque ${r.estoqueTotal} | pacientes ${r.qtdPacientes} | meses unid ${r.mesesEstoque} mg ${r.mesesEstoqueMg} | previsao:`,
      JSON.stringify(r.previsaoMgTotal)
    );
  }

  await disconnectMongo();
  console.log("\nSeed concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
