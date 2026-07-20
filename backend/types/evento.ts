export const EVENTO_ACOES = [
  "medication.create",
  "medication.add_quantity",
  "medication.update",
  "medication.delete",
  "medication.withdraw",
  "paciente.create",
  "paciente.update",
  "paciente.delete",
  "paciente.retorno.add",
  "usuario.register",
] as const;

export type EventoAcao = (typeof EVENTO_ACOES)[number];

export const EVENTO_ENTIDADES = ["medication", "paciente", "usuario"] as const;

export type EventoEntidade = (typeof EVENTO_ENTIDADES)[number];

export interface EventoDoc {
  _id: number;
  acao: EventoAcao;
  entidade_tipo: EventoEntidade;
  entidade_id: number | null;
  usuario_id: number;
  created_at: Date;
  detalhes: Record<string, unknown>;
}

export interface EventoListItem {
  id: number;
  acao: EventoAcao;
  entidade_tipo: EventoEntidade;
  entidade_id: number | null;
  usuario_id: number;
  usuario_email: string | null;
  created_at: string;
  detalhes: Record<string, unknown>;
}

export function isEventoAcao(value: unknown): value is EventoAcao {
  return typeof value === "string" && (EVENTO_ACOES as readonly string[]).includes(value);
}

export function isEventoEntidade(value: unknown): value is EventoEntidade {
  return typeof value === "string" && (EVENTO_ENTIDADES as readonly string[]).includes(value);
}
