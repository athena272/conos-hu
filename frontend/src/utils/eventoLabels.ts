import type { Evento, EventoAcao, EventoEntidade } from "../types/evento";
import { EVENTO_ACOES, EVENTO_ENTIDADES } from "../types/evento";

const ACAO_LABELS: Record<EventoAcao, string> = {
  "medication.create": "Cadastro de medicamento",
  "medication.add_quantity": "Entrada de quantidade",
  "medication.update": "Atualização de medicamento",
  "medication.delete": "Exclusão de medicamento",
  "medication.withdraw": "Retirada de medicamento",
  "paciente.create": "Cadastro de paciente",
  "paciente.update": "Atualização de paciente",
  "paciente.delete": "Exclusão de paciente",
  "paciente.retorno.add": "Adição de retorno",
  "usuario.register": "Registro de usuário",
  "usuario.identify": "Identificação de sessão",
};

const ENTIDADE_LABELS: Record<EventoEntidade, string> = {
  medication: "Medicamento",
  paciente: "Paciente",
  usuario: "Usuário",
};

export function getEventoAcaoLabel(acao: string): string {
  if ((EVENTO_ACOES as readonly string[]).includes(acao)) {
    return ACAO_LABELS[acao as EventoAcao];
  }
  return acao;
}

export function getEventoEntidadeLabel(entidade: string): string {
  if ((EVENTO_ENTIDADES as readonly string[]).includes(entidade)) {
    return ENTIDADE_LABELS[entidade as EventoEntidade];
  }
  return entidade;
}

const DETALHE_FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  lote: "Lote",
  quantidade: "Quantidade",
  concentracao: "Concentração",
  data_validade: "Validade",
  medication_id: "ID medicamento",
  paciente_id: "ID paciente",
  paciente_nome: "Paciente",
  prontuario: "Prontuário",
  data_retorno: "Data retorno",
  tipo_retorno: "Tipo retorno",
  email: "E-mail",
  ip: "IP",
};

/** Metadados internos (backfill etc.) — nunca exibir na UI. */
const DETALHE_KEYS_HIDDEN = new Set([
  "backfill",
  "backfill_source",
  "backfill_source_id",
  "responsavel_desconhecido",
  "operador_nome",
  "cpf",
  "user_agent",
]);

/** Ordem preferencial de exibição; campos restantes conhecidos vêm depois. */
const DETALHE_FIELD_ORDER = [
  "nome",
  "lote",
  "quantidade",
  "concentracao",
  "data_validade",
  "paciente_nome",
  "prontuario",
  "data_retorno",
  "tipo_retorno",
  "email",
  "ip",
  "medication_id",
  "paciente_id",
] as const;

export interface EventoDetalheEntry {
  key: string;
  label: string;
  value: string;
}

/**
 * Extrai pares rótulo/valor para UI.
 * Omite IDs internos quando já há nome legível e metadados de backfill.
 */
export function getEventoDetalheEntries(
  detalhes: Record<string, unknown> | null | undefined,
): EventoDetalheEntry[] {
  if (!detalhes || typeof detalhes !== "object") return [];

  const skip = new Set<string>(DETALHE_KEYS_HIDDEN);
  if (detalhes.nome != null && String(detalhes.nome).trim() !== "") {
    skip.add("medication_id");
  }
  if (detalhes.paciente_nome != null && String(detalhes.paciente_nome).trim() !== "") {
    skip.add("paciente_id");
  }

  const keys = Object.keys(detalhes).filter((key) => {
    if (skip.has(key)) return false;
    // Só campos com label conhecido — evita vazar chaves técnicas
    if (!(key in DETALHE_FIELD_LABELS)) return false;
    const value = detalhes[key];
    return value != null && value !== "";
  });

  keys.sort((a, b) => {
    const ia = (DETALHE_FIELD_ORDER as readonly string[]).indexOf(a);
    const ib = (DETALHE_FIELD_ORDER as readonly string[]).indexOf(b);
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    return ra - rb || a.localeCompare(b);
  });

  const entries: EventoDetalheEntry[] = keys.map((key) => ({
    key,
    label: DETALHE_FIELD_LABELS[key] ?? key,
    value: String(detalhes[key]),
  }));

  if (detalhes.responsavel_desconhecido === true) {
    entries.push({
      key: "responsavel_desconhecido",
      label: "Observação",
      value: "Responsável não registrado na época",
    });
  }

  return entries;
}

export function formatEventoDetalhes(detalhes: Record<string, unknown> | null | undefined): string {
  const entries = getEventoDetalheEntries(detalhes);
  if (entries.length === 0) return "—";
  return entries.map((e) => `${e.label}: ${e.value}`).join(" · ");
}

/** Formata created_at no padrão "YYYY-MM-DD HH:mm:ss" para dd/MM/yyyy HH:mm:ss. */
export function formatEventoDateTime(createdAt: string): string {
  const s = String(createdAt ?? "").trim();
  if (!s) return "—";
  const [datePart, timePart = ""] = s.split(/[ T]/);
  const dateBits = datePart.split("-");
  if (dateBits.length !== 3) return s;
  const [y, m, d] = dateBits;
  const time = timePart.slice(0, 8);
  return time
    ? `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y} ${time}`
    : `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Texto da coluna Responsável: nome do operador + conta (e-mail). */
export function formatEventoResponsavel(evento: Evento): string {
  const email = evento.usuario_email?.trim();
  let operador = evento.operador_nome?.trim() ?? "";
  if (!operador && evento.acao === "usuario.identify") {
    const nomeDetalhe = evento.detalhes?.nome;
    if (typeof nomeDetalhe === "string" && nomeDetalhe.trim()) {
      operador = nomeDetalhe.trim();
    }
  }

  if (operador && email) return `${operador} (${email})`;
  if (operador) return operador;
  if (email) return email;
  return `Usuário #${evento.usuario_id}`;
}

/** Busca case-insensitive em ação, entidade, responsável e detalhes. */
export function eventMatchesSearch(evento: Evento, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const entidadeLabel = getEventoEntidadeLabel(evento.entidade_tipo);
  const entidadeText =
    evento.entidade_id != null ? `${entidadeLabel} #${evento.entidade_id}` : entidadeLabel;

  const haystack = [
    getEventoAcaoLabel(evento.acao),
    evento.acao,
    entidadeText,
    evento.entidade_tipo,
    formatEventoResponsavel(evento),
    evento.usuario_email ?? "",
    evento.operador_nome ?? "",
    `Usuário #${evento.usuario_id}`,
    formatEventoDetalhes(evento.detalhes),
    formatEventoDateTime(evento.created_at),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

/** Opções sem value null — evita serialização acao[label] no Axios/PrimeReact. */
export const EVENTO_ACAO_FILTER_OPTIONS = EVENTO_ACOES.map((acao) => ({
  label: ACAO_LABELS[acao],
  value: acao as string,
}));

export const EVENTO_ENTIDADE_FILTER_OPTIONS = EVENTO_ENTIDADES.map((entidade) => ({
  label: ENTIDADE_LABELS[entidade],
  value: entidade as string,
}));
