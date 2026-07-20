import { describe, expect, it } from "vitest";
import type { Evento } from "../types/evento";
import {
  eventMatchesSearch,
  formatEventoDateTime,
  formatEventoDetalhes,
  getEventoAcaoLabel,
  getEventoDetalheEntries,
  getEventoEntidadeLabel,
} from "./eventoLabels";

const sampleEvento: Evento = {
  id: 1,
  acao: "medication.withdraw",
  entidade_tipo: "medication",
  entidade_id: 42,
  usuario_id: 3,
  usuario_email: "admin@exemplo.com",
  created_at: "2026-07-20 10:30:00",
  detalhes: { nome: "Metotrexato", quantidade: 2 },
};

describe("eventoLabels", () => {
  it("retorna labels conhecidos de ação e entidade", () => {
    expect(getEventoAcaoLabel("medication.withdraw")).toBe("Retirada de medicamento");
    expect(getEventoAcaoLabel("paciente.create")).toBe("Cadastro de paciente");
    expect(getEventoAcaoLabel("acao.desconhecida")).toBe("acao.desconhecida");

    expect(getEventoEntidadeLabel("medication")).toBe("Medicamento");
    expect(getEventoEntidadeLabel("paciente")).toBe("Paciente");
    expect(getEventoEntidadeLabel("outra")).toBe("outra");
  });

  it("formata detalhes legíveis e ignora vazios", () => {
    expect(
      formatEventoDetalhes({
        nome: "Metotrexato",
        lote: "L1",
        quantidade: 2,
        paciente_nome: "",
        email: null,
      }),
    ).toBe("Nome: Metotrexato · Lote: L1 · Quantidade: 2");

    expect(formatEventoDetalhes({})).toBe("—");
    expect(formatEventoDetalhes(undefined)).toBe("—");
  });

  it("getEventoDetalheEntries ordena e omite IDs redundantes", () => {
    expect(
      getEventoDetalheEntries({
        medication_id: 36,
        nome: "IT_RETIRA",
        lote: "L1",
        quantidade: 1,
        paciente_id: 52,
        paciente_nome: "Maria",
      }),
    ).toEqual([
      { key: "nome", label: "Nome", value: "IT_RETIRA" },
      { key: "lote", label: "Lote", value: "L1" },
      { key: "quantidade", label: "Quantidade", value: "1" },
      { key: "paciente_nome", label: "Paciente", value: "Maria" },
    ]);
  });

  it("getEventoDetalheEntries oculta metadados de backfill e traduz observação", () => {
    expect(
      getEventoDetalheEntries({
        nome: "Loratadina",
        lote: "LOR-2501",
        quantidade: 30,
        backfill: true,
        backfill_source: "movimentacoes",
        backfill_source_id: 8,
        responsavel_desconhecido: true,
      }),
    ).toEqual([
      { key: "nome", label: "Nome", value: "Loratadina" },
      { key: "lote", label: "Lote", value: "LOR-2501" },
      { key: "quantidade", label: "Quantidade", value: "30" },
      {
        key: "responsavel_desconhecido",
        label: "Observação",
        value: "Responsável não registrado na época",
      },
    ]);
  });

  it("formata data/hora do evento", () => {
    expect(formatEventoDateTime("2026-07-20 10:30:00")).toBe("20/07/2026 10:30:00");
    expect(formatEventoDateTime("2026-07-20T10:30:00")).toBe("20/07/2026 10:30:00");
    expect(formatEventoDateTime("")).toBe("—");
  });

  it("eventMatchesSearch filtra por responsável, ação e detalhes", () => {
    expect(eventMatchesSearch(sampleEvento, "")).toBe(true);
    expect(eventMatchesSearch(sampleEvento, "   ")).toBe(true);
    expect(eventMatchesSearch(sampleEvento, "admin@exemplo")).toBe(true);
    expect(eventMatchesSearch(sampleEvento, "RETIRADA")).toBe(true);
    expect(eventMatchesSearch(sampleEvento, "metotrexato")).toBe(true);
    expect(eventMatchesSearch(sampleEvento, "medicamento #42")).toBe(true);
    expect(eventMatchesSearch(sampleEvento, "inexistente-xyz")).toBe(false);
  });
});
