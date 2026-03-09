export type TipoRetorno =
  | "farmacia_medico"
  | "somente_farmacia"
  | "farmacia_enfermagem";

export interface PacienteMedicamento {
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
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
}

export interface ImpactoEstoque {
  estoqueTotal: number;
  pacientesVinculados: number;
  consumoDiarioAtual: number;
  consumoDiarioComNovo: number;
  mesesEstoqueAtual: number | null;
  mesesEstoqueComNovo: number | null;
}

export interface ResumoPorMedicamento {
  medicamento_nome: string;
  medicamento_concentracao: string;
  qtdPacientes: number;
  consumoDiarioTotal: number;
  estoqueTotal: number;
  mesesEstoque: number | null;
}

export interface MedicamentoDistinto {
  nome: string;
  concentracao: string;
}
