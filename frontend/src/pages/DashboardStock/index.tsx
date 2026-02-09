import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import CardKanban from "../../components/CardKanban";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

function DashboardStock() {
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);

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

        <CardKanban medications={medications} />
      </div>
    </div>
  );
}

export default DashboardStock;
