import { useMemo, useRef, useCallback } from "react";
import { Toast } from "primereact/toast";
import { TabView, TabPanel } from "primereact/tabview";
import { api } from "../../api/client";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import InlineLoader from "../../components/InlineLoader";
import CardKanban from "../../components/CardKanban";
import CardKanbanMedication from "../../components/CardKanbanMedication";
import { aggregateByMedication } from "../../utils/stockAggregation";
import { useApiQuery } from "../../hooks/useApiQuery";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

function DashboardStock() {
  const toast = useRef<Toast>(null);

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchMedications = useCallback(async () => {
    const response = await api.get<MedicationWithStatus[]>("/medications");
    return response.data ?? [];
  }, []);

  const { data: medications, loading } = useApiQuery(fetchMedications, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const medicationsAggregated = useMemo(
    () => aggregateByMedication(medications),
    [medications],
  );

  return (
    <div>
      <Toast ref={toast} position="top-right" />
      <Header />
      <Menu />
      <div className="container-stock">
        <div className="title-stock">
          <h2>Painel de Estoque</h2>
        </div>

        {loading ? (
          <InlineLoader message="Carregando estoque..." />
        ) : (
          <TabView>
            <TabPanel header="Por Lote">
              <CardKanban medications={medications} />
            </TabPanel>
            <TabPanel header="Por Medicamento">
              <CardKanbanMedication medications={medicationsAggregated} />
            </TabPanel>
          </TabView>
        )}
      </div>
    </div>
  );
}

export default DashboardStock;
