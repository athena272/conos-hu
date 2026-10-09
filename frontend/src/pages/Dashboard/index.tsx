import { useRef, useCallback, useMemo } from "react";
import { Toast } from "primereact/toast";
import { api } from "../../api/client";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import StatusCard from "../../components/StatusCard";
import ChartCard from "../../components/ChartCard";
import FullScreenLoader from "../../components/FullScreenLoader";
import { PageHeader } from "../../components/layout/PageHeader";
import { LayoutDashboard } from "lucide-react";
import { useApiQuery } from "../../hooks/useApiQuery";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

import "./styles.css";
import type { MedicationWithStatus } from "../../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

const categoryColorsTitle = {
  emEstoque: "#D7F3EA",
  emFalta: "#F5D2D2",
  proximoVencer: "#FAF0D5",
  foraValidade: "#FF8C8C",
};

interface MedicationStats {
  emEstoque: number;
  emFalta: number;
  proximoVencer: number;
  foraValidade: number;
}

interface DashboardData {
  medicationStats: MedicationStats;
  medicationLoteStats: Record<string, number>;
}

const EMPTY_STATS: MedicationStats = {
  emEstoque: 0,
  emFalta: 0,
  proximoVencer: 0,
  foraValidade: 0,
};

function buildDashboardData(
  medications: MedicationWithStatus[],
): DashboardData {
  const statusCounts: MedicationStats = { ...EMPTY_STATS };
  const loteCounts: Record<string, number> = {};

  medications.forEach((med) => {
    if (med.status === "emFalta") {
      statusCounts.emFalta += 1;
    } else {
      statusCounts[med.status as keyof MedicationStats] +=
        med.quantidade || 0;
    }
    loteCounts[med.lote] = (loteCounts[med.lote] || 0) + med.quantidade;
  });

  return {
    medicationStats: statusCounts,
    medicationLoteStats: loteCounts,
  };
}

const Dashboard = () => {
  const toast = useRef<Toast>(null);

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchDashboard = useCallback(async () => {
    const { data: medications } =
      await api.get<MedicationWithStatus[]>("/medications");
    return buildDashboardData(medications);
  }, []);

  const { data, loading } = useApiQuery(fetchDashboard, [], {
    initialData: {
      medicationStats: EMPTY_STATS,
      medicationLoteStats: {},
    },
    onError: (message) => showFetchError(message),
  });

  const { medicationStats, medicationLoteStats } = data;

  const chartData = useMemo(
    () => ({
      labels: ["Em Estoque", "Em Falta", "Próximo a Vencer", "Fora da Validade"],
      datasets: [
        {
          label: "Quantidade por Status",
          data: Object.values(medicationStats),
          backgroundColor: Object.values(categoryColorsTitle),
        },
      ],
    }),
    [medicationStats],
  );

  const loteChartData = useMemo(
    () => ({
      labels: Object.keys(medicationLoteStats),
      datasets: [
        {
          label: "Quantidade por Lote",
          data: Object.values(medicationLoteStats),
          backgroundColor: "#A9A9A9",
        },
      ],
    }),
    [medicationLoteStats],
  );

  return (
    <div>
      <Toast ref={toast} position="top-right" />
      <FullScreenLoader active={loading} message="Carregando..." />
      <Header />
      <Menu />
      <div className="dashboard-container">
        <div className="dashboard-title">
          <PageHeader
            title="Painel de Controle"
            description="Visão geral do estoque por status e distribuição dos medicamentos."
            icon={LayoutDashboard}
          />
        </div>

        {!loading && (
          <>
            <div className="status-container">
              <StatusCard
                title="Em Estoque"
                value={medicationStats.emEstoque}
                backgroundColor={categoryColorsTitle.emEstoque}
              />
              <StatusCard
                title="Em Falta"
                value={medicationStats.emFalta}
                backgroundColor={categoryColorsTitle.emFalta}
              />
              <StatusCard
                title="Próximo a Vencer"
                value={medicationStats.proximoVencer}
                backgroundColor={categoryColorsTitle.proximoVencer}
              />
              <StatusCard
                title="Fora da Validade"
                value={medicationStats.foraValidade}
                backgroundColor={categoryColorsTitle.foraValidade}
              />
            </div>

            <div className="chart-container">
              <ChartCard
                title="Quantidade por Status"
                chart={<Bar data={chartData} />}
              />
              <ChartCard
                title="Medicamentos por Lote"
                chart={<Bar data={loteChartData} />}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
