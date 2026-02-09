export type MedicationStatus =
  | "emEstoque"
  | "emFalta"
  | "proximoVencer"
  | "foraValidade";

export interface Medication {
  id: number;
  nome: string;
  lote: string;
  quantidade: number;
  classificacao?: string;
  concentracao?: string;
  forma?: string | number;
  data_validade: string;
  data_cadastro?: string;
  status: MedicationStatus;
}

export interface MedicationWithStatus extends Medication {
  status: MedicationStatus;
}

export interface QuantityResponse {
  total: number;
}
