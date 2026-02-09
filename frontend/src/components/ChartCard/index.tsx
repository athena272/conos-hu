import { ReactElement } from "react";
import { Card } from "primereact/card";
import "./styles.css";

interface ChartCardProps {
  title: string;
  chart: ReactElement;
}

const ChartCard = ({ title, chart }: ChartCardProps) => (
  <div className="chart">
    <Card title={title}>{chart}</Card>
  </div>
);

export default ChartCard;
