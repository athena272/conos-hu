export type TipoRetorno =
  | "farmacia_medico"
  | "somente_farmacia"
  | "farmacia_enfermagem";

export type RegimeConsumoMedicamento = "diario" | "por_ciclo" | "por_miligrama";

export type ContextualRotulo = "mg/dia" | "mg/ciclo";

export interface PrevisaoMg {
  mg_dia_previsto: number | null;
  mg_mes_previsto: number | null;
  mg_contextual: number | null;
  contextual_rotulo: ContextualRotulo;
}

export interface PacienteMedicamento {
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  regime_consumo?: RegimeConsumoMedicamento;
  unidades_por_ciclo?: number | null;
  intervalo_ciclo_dias?: number | null;
  consumo_mg_diario?: number | null;
  /** Previsão de consumo em mg (não depende de retiradas) */
  previsao_mg?: PrevisaoMg;
}

/** Sentinela de API quando nome/prontuário estão redatados para viewer */
export const PRONTUARIO_REDACT_SENTINEL = -1;

export interface Paciente {
  id: number;
  nome: string;
  prontuario: number;
  /** Quando true, nome/prontuário são placeholders (perfil visualização) */
  identificadoresRedatados?: boolean;
  apac: string;
  diagnostico: string;
  medicamentos: PacienteMedicamento[];
  observacoes: string | null;
  telefone: string;
  data_liberacao: string;
  retorna_servico: number;
  tipo_retorno: TipoRetorno | null;
  proxima_data_retorno?: string | null;
  lotes?: string[];
}

export interface PacienteRetorno {
  id: number;
  data_retorno: string;
  tipo_retorno: string | null;
  created_at?: string;
}

export interface ImpactoEstoque {
  estoqueTotal: number;
  pacientesVinculados: number;
  consumoDiarioAtual: number;
  consumoDiarioComNovo: number;
  mesesEstoqueAtual: number | null;
  mesesEstoqueComNovo: number | null;
  consumoMgDiarioAtual?: number;
  consumoMgDiarioComNovo?: number;
  consumoMgMesComNovo?: number | null;
  mesesEstoqueMgAtual?: number | null;
  mesesEstoqueMgComNovo?: number | null;
}

export type ResumoTaxaTipo = "por_ciclo_homogeneo" | "diario_apenas" | "agregado";

export interface ResumoPorMedicamento {
  medicamento_nome: string;
  medicamento_concentracao: string;
  qtdPacientes: number;
  consumoDiarioTotal: number;
  estoqueTotal: number;
  mesesEstoque: number | null;
  mesesEstoqueMg?: number | null;
  previsaoMgTotal?: PrevisaoMg;
  resumoTaxaTipo?: ResumoTaxaTipo;
  porCicloUnidadesTotal?: number;
  porCicloIntervaloDias?: number;
}

export interface MedicamentoDistinto {
  nome: string;
  concentracao: string;
}
