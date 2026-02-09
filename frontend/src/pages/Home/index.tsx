import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { FilterMatchMode } from "primereact/api";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { formatDateBR, toInputDateValue } from "../../utils/dateUtils";

import Header from "../../components/Header";
import Menu from "../../components/Menu";

import "./styles.scss";
import type { MedicationWithStatus } from "../../types";

const FORMA_OPTIONS = [
  { label: "Comprimido", value: 1 },
  { label: "Injetável", value: 2 },
  { label: "Gotas", value: 3 },
  { label: "Outros", value: 4 },
];

function toFormaValue(forma: string | number | undefined): number {
  const v = String(forma ?? "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return parseInt(v, 10);
  return 1;
}

export default function Home() {
  const location = useLocation();
  const toast = useRef<Toast>(null);
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    nome: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    status: { value: null as string | null, matchMode: FilterMatchMode.EQUALS },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [editingMedication, setEditingMedication] = useState<MedicationWithStatus | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    lote: "",
    quantidade: 0,
    classificacao: "",
    concentracao: "",
    forma: 1,
    data_validade: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [statusOptions] = useState([
    { label: "Em Estoque", value: "emEstoque" },
    { label: "Em Falta", value: "emFalta" },
    { label: "Fora da Validade", value: "foraValidade" },
    { label: "Próximo a Vencer", value: "proximoVencer" },
  ]);

  const fetchMedications = () => {
    axios.get<MedicationWithStatus[]>(`${API_BASE_URL}/medications`).then((response) => {
      setMedications(response.data ?? []);
    });
  };

  useEffect(() => {
    if (location.pathname === "/home") fetchMedications();
  }, [location.pathname]);

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

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const _filters = { ...filters };
    _filters["global"].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const openEdit = (row: MedicationWithStatus) => {
    setEditingMedication(row);
    setEditForm({
      nome: row.nome ?? "",
      lote: row.lote ?? "",
      quantidade: row.quantidade ?? 0,
      classificacao: row.classificacao ?? "",
      concentracao: row.concentracao ?? "",
      forma: toFormaValue(row.forma),
      data_validade: toInputDateValue(row.data_validade),
    });
  };

  const closeEdit = () => {
    setEditingMedication(null);
    setSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editingMedication) return;
    setSavingEdit(true);
    try {
      await axios.put(`${API_BASE_URL}/medications/${editingMedication.id}`, {
        nome: editForm.nome,
        lote: editForm.lote,
        quantidade: editForm.quantidade,
        classificacao: editForm.classificacao,
        concentracao: editForm.concentracao,
        forma: String(editForm.forma),
        data_validade: editForm.data_validade,
      });
      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: "Medicação atualizada com sucesso.",
        life: 3000,
      });
      closeEdit();
      fetchMedications();
    } catch (error: unknown) {
      toast.current?.show({
        severity: "error",
        summary: "Erro!",
        detail: normalizeErrorMessage(error),
        life: 4000,
      });
    } finally {
      setSavingEdit(false);
    }
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
      <Toast ref={toast} position="top-right" />
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
            formatDateBR(rowData.data_validade)
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
        <Column
          header="Ações"
          body={(rowData: MedicationWithStatus) => (
            <Button
              label="Editar"
              icon="pi pi-pencil"
              className="p-button-sm"
              onClick={() => openEdit(rowData)}
            />
          )}
          style={{ minWidth: "8rem" }}
        />
      </DataTable>

      <Dialog
        header="Editar medicação"
        visible={!!editingMedication}
        onHide={closeEdit}
        className="home-edit-dialog"
        style={{ width: "92vw", maxWidth: "580px" }}
        contentClassName="home-edit-dialog-content"
        footer={
          <div>
            <Button label="Cancelar" className="p-button-text" onClick={closeEdit} />
            <Button label="Salvar" onClick={handleSaveEdit} loading={savingEdit} disabled={savingEdit} />
          </div>
        }
      >
        {editingMedication && (
          <div className="edit-form-fields">
            <div className="p-field">
              <label htmlFor="edit-nome">Nome</label>
              <InputText
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="p-field">
              <label htmlFor="edit-lote">Lote</label>
              <InputText
                id="edit-lote"
                value={editForm.lote}
                onChange={(e) => setEditForm((f) => ({ ...f, lote: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="p-field">
              <label htmlFor="edit-quantidade">Quantidade</label>
              <InputText
                id="edit-quantidade"
                type="number"
                value={String(editForm.quantidade)}
                onChange={(e) => setEditForm((f) => ({ ...f, quantidade: parseInt(e.target.value, 10) || 0 }))}
                className="w-full"
              />
            </div>
            <div className="p-field">
              <label htmlFor="edit-classificacao">Classificação</label>
              <InputText
                id="edit-classificacao"
                value={editForm.classificacao}
                onChange={(e) => setEditForm((f) => ({ ...f, classificacao: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="p-field">
              <label htmlFor="edit-concentracao">Concentração</label>
              <InputText
                id="edit-concentracao"
                value={editForm.concentracao}
                onChange={(e) => setEditForm((f) => ({ ...f, concentracao: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="p-field">
              <label htmlFor="edit-forma">Forma Farmacêutica</label>
              <Dropdown
                id="edit-forma"
                value={editForm.forma}
                options={FORMA_OPTIONS}
                onChange={(e) => setEditForm((f) => ({ ...f, forma: e.value }))}
                className="w-full"
              />
            </div>
            <div className="p-field">
              <label htmlFor="edit-validade">Data de Validade</label>
              <InputText
                id="edit-validade"
                type="date"
                value={editForm.data_validade}
                onChange={(e) => setEditForm((f) => ({ ...f, data_validade: e.target.value }))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
