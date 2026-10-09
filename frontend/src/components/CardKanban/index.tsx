import { useMemo, useState } from "react";
import { AppDropdown } from "../forms/AppDropdown";
import { formatDateBR } from "../../utils/dateUtils";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

interface CardKanbanProps {
  medications: MedicationWithStatus[];
}

interface StatusOption {
  name: string;
  code: string | null;
}

function CardKanban({ medications }: CardKanbanProps) {
  const [filterStatus, setFilterStatus] = useState<StatusOption | null>(null);

  const statusOptions: StatusOption[] = [
    { name: "Todos", code: null },
    { name: "Em Estoque", code: "emEstoque" },
    { name: "Próximo a Vencimento", code: "proximoVencer" },
    { name: "Fora da Validade", code: "foraValidade" },
    { name: "Em Falta", code: "emFalta" },
  ];

  const filteredMedications = useMemo(() => {
    return filterStatus?.code
      ? medications.filter((med) => med.status === filterStatus.code)
      : medications;
  }, [medications, filterStatus]);

  const categories = useMemo(() => {
    return {
      emEstoque: filteredMedications.filter(
        (med) => med.status === "emEstoque",
      ),
      proximoVencer: filteredMedications.filter(
        (med) => med.status === "proximoVencer",
      ),
      foraValidade: filteredMedications.filter(
        (med) => med.status === "foraValidade",
      ),
      emFalta: filteredMedications.filter((med) => med.status === "emFalta"),
    };
  }, [filteredMedications]);

  const categoryColorsTitle: Record<string, string> = {
    emEstoque: "#1AD698",
    proximoVencer: "#FFBB00",
    foraValidade: "#A83232",
    emFalta: "#FF3838",
  };

  const categoryColors: Record<string, string> = {
    emEstoque: "#D7F3EA",
    proximoVencer: "#FAF0D5",
    foraValidade: "#F8D7DA",
    emFalta: "#F5D2D2",
  };

  const orderedStatuses = [
    "emEstoque",
    "proximoVencer",
    "foraValidade",
    "emFalta",
  ];

  return (
    <div>
      <div className="kanban-filter">
        <AppDropdown
          inputId="kanban-filtro-status"
          name="kanban-filtro-status"
          value={filterStatus}
          onChange={(e) => {
            console.log("Novo status selecionado:", e.value);
            setFilterStatus(e.value);
          }}
          options={statusOptions}
          optionLabel="name"
          placeholder="Selecione o status"
          className="w-full md:w-14rem"
        />
      </div>

      <div className="kanban-container">
        {orderedStatuses.map((status) => {
          if (filterStatus?.code && filterStatus.code !== status) return null;

          return (
            <div key={status} className="kanban-column">
              <div
                className="title-card-categories"
                style={{
                  backgroundColor: categoryColorsTitle[status],
                  borderRadius: "5px",
                }}
              >
                <h3>
                  {status === "emEstoque" && "Em estoque"}
                  {status === "proximoVencer" && "Próximo ao vencimento"}
                  {status === "foraValidade" && "Fora da Validade"}
                  {status === "emFalta" && "Medicamentos em falta"}
                </h3>
              </div>

              {categories[status as keyof typeof categories].length > 0 ? (
                categories[status as keyof typeof categories].map((med) => (
                  <div
                    key={med.id}
                    className="kanban-card"
                    style={{
                      backgroundColor: categoryColors[status],
                    }}
                  >
                    <p>
                      <strong>Medicamento:</strong> {med.nome}
                    </p>
                    <p>
                      <strong>Lote:</strong> {med.lote}
                    </p>
                    <p>
                      <strong>Quantidade:</strong> {med.quantidade}
                    </p>
                    <p>
                      <strong>Validade:</strong>{" "}
                      {formatDateBR(med.data_validade)}
                    </p>
                  </div>
                ))
              ) : (
                <p>Nenhum medicamento.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CardKanban;
