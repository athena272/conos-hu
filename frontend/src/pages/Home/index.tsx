import { useState, useEffect } from "react";
import { FilterMatchMode } from "primereact/api";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";

import Header from "../../components/Header";
import Menu from "../../components/Menu";

import "./styles.css";
import type { MedicationWithStatus } from "../../types";

export default function Home() {
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    nome: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    status: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [statusOptions] = useState([
    { label: "Em Estoque", value: "emEstoque" },
    { label: "Em Falta", value: "emFalta" },
    { label: "Fora da Validade", value: "foraValidade" },
    { label: "Próximo a Vencer", value: "proximoVencer" },
  ]);

  useEffect(() => {
    axios.get<MedicationWithStatus[]>(`${API_BASE_URL}/medications`).then((response) => {
      setMedications(response.data);
    });
  }, []);

  const getStatusTag = (status: string) => {
    const statusColors: Record<
      string,
      { label: string; color: string }
    > = {
      emEstoque: { label: "Em Estoque", color: "#1AD698" },
      proximoVencer: { label: "Próximo a Vencer", color: "#FFBB00" },
      foraValidade: { label: "Fora da Validade", color: "#A83232" },
      emFalta: { label: "Em Falta", color: "#FF3838" },
    };

    const statusInfo =
      statusColors[status] || { label: "Desconhecido", color: "#CCC" };

    return (
      <Tag
        value={statusInfo.label}
        style={{
          backgroundColor: statusInfo.color,
          color: "#FFF",
          fontWeight: "bold",
          borderRadius: "5px",
          padding: "5px 10px",
        }}
      />
    );
  };

  const getForma = (formaCode: string | number | undefined): string => {
    switch (String(formaCode)) {
      case "1":
        return "Comprimido";
      case "2":
        return "Injetável";
      case "3":
        return "Gotas";
      case "4":
        return "Outros";
      default:
        return "Desconhecido";
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const _filters = { ...filters };
    _filters["global"].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const header = (
    <div className="filters-container">
      <InputText
        value={globalFilterValue}
        onChange={onGlobalFilterChange}
        placeholder="Buscar Medicação"
      />
      <Dropdown
        value={filters.status.value}
        options={statusOptions}
        onChange={(e) => {
          setFilters((prevFilters) => ({
            ...prevFilters,
            status: { ...prevFilters.status, value: e.value },
          }));
        }}
        placeholder="Filtrar por Status"
      />
    </div>
  );

  return (
    <div className="home-container">
      <Header />
      <Menu />
      <div className="title-home">
        <h2>Medicações</h2>
      </div>
      <DataTable
        value={medications}
        paginator
        rows={10}
        filters={filters}
        filterDisplay="row"
        globalFilterFields={["nome", "lote", "status"]}
        header={header}
        emptyMessage="Nenhuma medicação encontrada."
      >
        <Column field="nome" header="Nome" style={{ minWidth: "12rem" }} />
        <Column field="lote" header="Lote" style={{ minWidth: "10rem" }} />
        <Column
          field="quantidade"
          header="Quantidade"
          style={{ minWidth: "10rem" }}
        />
        <Column
          field="classificacao"
          header="Classificação"
          style={{ minWidth: "12rem" }}
        />
        <Column
          field="concentracao"
          header="Concentração"
          style={{ minWidth: "12rem" }}
        />
        <Column
          field="forma"
          header="Forma Farmacêutica"
          body={(rowData: MedicationWithStatus) => getForma(rowData.forma)}
          style={{ minWidth: "10rem" }}
        />
        <Column
          field="data_validade"
          header="Data de Validade"
          body={(rowData: MedicationWithStatus) =>
            formatDate(rowData.data_validade)
          }
          style={{ minWidth: "12rem" }}
        />
        <Column
          field="status"
          header="Status"
          body={(rowData: MedicationWithStatus) =>
            getStatusTag(rowData.status)
          }
          style={{ minWidth: "10rem" }}
        />
      </DataTable>
    </div>
  );
}
