import { useEffect, useMemo, useState } from "react";
import { TabView, TabPanel } from "primereact/tabview";
import { api } from "../../api/client";
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
    api
      .get<MedicationWithStatus[]>("/medications")
      .then((response) => {
        setMedications(response.data);
      })
      .catch((error) => {
        console.error("Erro ao buscar os medicamentos:", error);
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
