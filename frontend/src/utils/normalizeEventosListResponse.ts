import type { Evento, EventosListResponse } from "../types/evento";

/**
 * Normalizes GET /eventos payloads across API versions.
 * New: { items, total, page, totalPages, limit }
 * Legacy (pre-pagination): Evento[]
 */
export function normalizeEventosListResponse(
  data: unknown,
  fallback: { page: number; limit: number },
): EventosListResponse {
  if (Array.isArray(data)) {
    const items = data as Evento[];
    const total = items.length;
    const limit = Math.max(1, fallback.limit);
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const page = Math.min(Math.max(1, fallback.page), totalPages);
    return { items, total, page, totalPages, limit };
  }

  if (data && typeof data === "object") {
    const body = data as Partial<EventosListResponse>;
    if (Array.isArray(body.items)) {
      const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : fallback.limit;
      const total = typeof body.total === "number" ? body.total : body.items.length;
      const totalPages =
        typeof body.totalPages === "number" && body.totalPages > 0
          ? body.totalPages
          : Math.max(1, Math.ceil(total / Math.max(1, limit)) || 1);
      const page =
        typeof body.page === "number" && body.page > 0 ? body.page : fallback.page;
      return {
        items: body.items,
        total,
        page,
        totalPages,
        limit,
      };
    }
  }

  return {
    items: [],
    total: 0,
    page: fallback.page,
    totalPages: 1,
    limit: fallback.limit,
  };
}
