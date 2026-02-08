import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import StatusCard from "../../components/StatusCard";
import ChartCard from "../../components/ChartCard";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const categoryColorsTitle = {
  emEstoque: "#D7F3EA",
  emFalta: "#F5D2D2",
  proximoVencer: "#FAF0D5",
  foraValidade: "#FF8C8C",
};

const Dashboard = () => {
  const [medicationStats, setMedicationStats] = useState({
    emEstoque: 0,
    emFalta: 0,
    proximoVencer: 0,
    foraValidade: 0,
  });

  const [medicationLoteStats, setMedicationLoteStats] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data: medications } = await axios.get(
        "http://localhost:3001/medications"
      );

      const statusCounts = {
        emEstoque: 0,
        emFalta: 0,
        proximoVencer: 0,
        foraValidade: 0,
      };

      const loteCounts = {};

      medications.forEach((med) => {
        // Contar o número de medicamentos em falta (não soma quantidade, apenas conta itens)
        if (med.status === "emFalta") {
          statusCounts.emFalta += 1;
        } else {
          statusCounts[med.status] += med.quantidade || 0;
        }

        loteCounts[med.lote] = (loteCounts[med.lote] || 0) + med.quantidade;
      });

      setMedicationStats(statusCounts);
      setMedicationLoteStats(loteCounts);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar os dados:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const chartData = {
    labels: ["Em Estoque", "Em Falta", "Próximo a Vencer", "Fora da Validade"],
    datasets: [
      {
        label: "Quantidade por Status",
        data: Object.values(medicationStats),
        backgroundColor: Object.values(categoryColorsTitle),
      },
    ],
  };

  const loteChartData = {
    labels: Object.keys(medicationLoteStats),
    datasets: [
      {
        label: "Quantidade por Lote",
        data: Object.values(medicationLoteStats),
        backgroundColor: "#A9A9A9",
      },
    ],
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <Header />
      <Menu />
      <div className="dashboard-container">
        <div className="dashboard-title">
          <h2>Painel de Controle</h2>
        </div>

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
      </div>
    </div>
  );
};

export default Dashboard;