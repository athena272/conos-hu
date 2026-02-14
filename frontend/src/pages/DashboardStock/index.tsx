import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { TabView, TabPanel } from "primereact/tabview";
import { API_BASE_URL } from "../../config/api";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import CardKanban from "../../components/CardKanban";
import CardKanbanMedication from "../../components/CardKanbanMedication";
import { aggregateByMedication } from "../../utils/stockAggregation";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

function DashboardStock() {
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);

  const medicationsAggregated = useMemo(
    () => aggregateByMedication(medications),
    [medications]
  );

  useEffect(() => {
    axios
      .get<MedicationWithStatus[]>(`${API_BASE_URL}/medications`)
      .then((response) => {
        setMedications(response.data);
      })
      .catch((error) => {
        console.error("Erro ao buscar as medicações:", error);
      });
  }, []);

  return (
    <div>
      <Header />
      <Menu />
      <div className="container-stock">
        <div className="title-stock">
          <h2>Painel de Estoque</h2>
        </div>

        <TabView>
          <TabPanel header="Por Lote">
            <CardKanban medications={medications} />
          </TabPanel>
          <TabPanel header="Por Medicamento">
            <CardKanbanMedication medications={medicationsAggregated} />
          </TabPanel>
        </TabView>
      </div>
    </div>
  );
}

export default DashboardStock;
