export type TipoRetorno =
  | "farmacia_medico"
  | "somente_farmacia"
  | "farmacia_enfermagem";

export type RegimeConsumoMedicamento = "diario" | "por_ciclo";

export interface PacienteMedicamento {
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  regime_consumo?: RegimeConsumoMedicamento;
  unidades_por_ciclo?: number | null;
  intervalo_ciclo_dias?: number | null;
}

export interface Paciente {
  id: number;
  nome: string;
  prontuario: number;
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
}

export type ResumoTaxaTipo = "por_ciclo_homogeneo" | "diario_apenas" | "agregado";

export interface ResumoPorMedicamento {
  medicamento_nome: string;
  medicamento_concentracao: string;
  qtdPacientes: number;
  consumoDiarioTotal: number;
  estoqueTotal: number;
  mesesEstoque: number | null;
  resumoTaxaTipo?: ResumoTaxaTipo;
  porCicloUnidadesTotal?: number;
  porCicloIntervaloDias?: number;
}

export interface MedicamentoDistinto {
  nome: string;
  concentracao: string;
}
