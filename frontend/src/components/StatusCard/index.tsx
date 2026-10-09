import { Card } from "primereact/card";
import "./styles.css";

interface StatusCardProps {
  title: string;
  value: number;
  backgroundColor?: string;
}

const StatusCard = ({ title, value, backgroundColor }: StatusCardProps) => (
  <Card className="card" style={{ backgroundColor }}>
    <h4>{title}</h4>
    <p className="m-0">{value || 0}</p>
  </Card>
);

export default StatusCard;
