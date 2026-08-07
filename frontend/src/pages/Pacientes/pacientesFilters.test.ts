import { describe, expect, it } from "vitest";
import type { Paciente } from "../../types";
import {
  filterPacientesByDataLiberacaoRange,
  filterPacientesByProximaDataRetornoRange,
  parsePacientesSortKey,
} from "./pacientesFilters";

function paciente(
  partial: Partial<Paciente> & Pick<Paciente, "id" | "data_liberacao">,
): Paciente {
  return {
    nome: `Paciente ${partial.id}`,
    prontuario: partial.id,
    apac: "",
    diagnostico: "",
    medicamentos: [],
    observacoes: null,
    telefone: "",
    retorna_servico: 0,
    tipo_retorno: null,
    ...partial,
  };
}

describe("filterPacientesByDataLiberacaoRange", () => {
  const list = [
    paciente({ id: 1, data_liberacao: "2025-01-10" }),
    paciente({ id: 2, data_liberacao: "2025-02-15" }),
    paciente({ id: 3, data_liberacao: "2025-03-20" }),
  ];

  it("mantém todos quando ambos os bounds estão vazios", () => {
    expect(filterPacientesByDataLiberacaoRange(list, "", "").map((p) => p.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("filtra intervalo inclusivo", () => {
    expect(
      filterPacientesByDataLiberacaoRange(
        list,
        "10/01/2025",
        "15/02/2025",
      ).map((p) => p.id),
    ).toEqual([1, 2]);
  });

  it("aplica só o bound inicial", () => {
    expect(
      filterPacientesByDataLiberacaoRange(list, "15/02/2025", "").map((p) => p.id),
    ).toEqual([2, 3]);
  });

  it("aplica só o bound final", () => {
    expect(
      filterPacientesByDataLiberacaoRange(list, "", "10/01/2025").map((p) => p.id),
    ).toEqual([1]);
  });

  it("ignora datas BR inválidas ou incompletas", () => {
    expect(
      filterPacientesByDataLiberacaoRange(list, "99/99/9999", "01/").map((p) => p.id),
    ).toEqual([1, 2, 3]);
  });
});

describe("filterPacientesByProximaDataRetornoRange", () => {
  const list = [
    paciente({
      id: 1,
      data_liberacao: "2025-01-01",
      proxima_data_retorno: "2025-09-05",
    }),
    paciente({
      id: 2,
      data_liberacao: "2025-01-01",
      proxima_data_retorno: "2025-09-20",
    }),
    paciente({
      id: 3,
      data_liberacao: "2025-01-01",
      proxima_data_retorno: "2025-10-01",
    }),
    paciente({
      id: 4,
      data_liberacao: "2025-01-01",
      proxima_data_retorno: null,
    }),
    paciente({ id: 5, data_liberacao: "2025-01-01" }),
  ];

  it("mantém todos quando ambos os bounds estão vazios (inclui sem retorno)", () => {
    expect(
      filterPacientesByProximaDataRetornoRange(list, "", "").map((p) => p.id),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("filtra intervalo inclusivo de setembro", () => {
    expect(
      filterPacientesByProximaDataRetornoRange(
        list,
        "01/09/2025",
        "30/09/2025",
      ).map((p) => p.id),
    ).toEqual([1, 2]);
  });

  it("exclui pacientes sem proxima_data_retorno quando há bound ativo", () => {
    expect(
      filterPacientesByProximaDataRetornoRange(list, "01/09/2025", "").map(
        (p) => p.id,
      ),
    ).toEqual([1, 2, 3]);
  });

  it("aplica só o bound final", () => {
    expect(
      filterPacientesByProximaDataRetornoRange(list, "", "05/09/2025").map(
        (p) => p.id,
      ),
    ).toEqual([1]);
  });
});

describe("parsePacientesSortKey", () => {
  it("parseia campo com underscore e direção asc", () => {
    expect(parsePacientesSortKey("proxima_data_retorno_asc")).toEqual({
      field: "proxima_data_retorno",
      dir: "asc",
    });
  });

  it("parseia data_liberacao_desc", () => {
    expect(parsePacientesSortKey("data_liberacao_desc")).toEqual({
      field: "data_liberacao",
      dir: "desc",
    });
  });

  it("parseia nome_asc", () => {
    expect(parsePacientesSortKey("nome_asc")).toEqual({
      field: "nome",
      dir: "asc",
    });
  });
});
