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
  "usuario.identify",
] as const;

export type EventoAcao = (typeof EVENTO_ACOES)[number];

export const EVENTO_ENTIDADES = ["medication", "paciente", "usuario"] as const;

export type EventoEntidade = (typeof EVENTO_ENTIDADES)[number];

export interface Evento {
  id: number;
  acao: EventoAcao | string;
  entidade_tipo: EventoEntidade | string;
  entidade_id: number | null;
  usuario_id: number;
  usuario_email: string | null;
  operador_nome: string | null;
  created_at: string;
  detalhes: Record<string, unknown>;
}
