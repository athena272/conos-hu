import { describe, expect, it } from "vitest";
import { normalizeEventosListResponse } from "./normalizeEventosListResponse";
import type { Evento } from "../types/evento";

const sample: Evento = {
  id: 1,
  acao: "medication.create",
  entidade_tipo: "medication",
  entidade_id: 10,
  usuario_id: 2,
  usuario_email: "a@b.com",
  operador_nome: null,
  created_at: "2026-01-01 00:00:00",
  detalhes: {},
};

describe("normalizeEventosListResponse", () => {
  it("accepts the paginated envelope", () => {
    expect(
      normalizeEventosListResponse(
        { items: [sample], total: 40, page: 2, totalPages: 4, limit: 10 },
        { page: 1, limit: 20 },
      ),
    ).toEqual({
      items: [sample],
      total: 40,
      page: 2,
      totalPages: 4,
      limit: 10,
    });
  });

  it("normalizes legacy array responses so the UI does not show empty", () => {
    expect(
      normalizeEventosListResponse([sample, sample], { page: 1, limit: 20 }),
    ).toEqual({
      items: [sample, sample],
      total: 2,
      page: 1,
      totalPages: 1,
      limit: 20,
    });
  });

  it("falls back to an empty page for unexpected payloads", () => {
    expect(normalizeEventosListResponse(null, { page: 3, limit: 10 })).toEqual({
      items: [],
      total: 0,
      page: 3,
      totalPages: 1,
      limit: 10,
    });
  });
});
