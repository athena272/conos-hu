import { Card } from "primereact/card";
import PropTypes from "prop-types";
import "./styles.css";

const StatusCard = ({ title, value, backgroundColor }) => (
  <Card className="card" style={{ backgroundColor }}>
    <h4>{title}</h4>
    <p className="m-0">{value || 0}</p>
  </Card>
);

StatusCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  backgroundColor: PropTypes.string,
};

export default StatusCard;
