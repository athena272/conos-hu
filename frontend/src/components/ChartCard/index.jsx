import { Card } from "primereact/card";
import PropTypes from "prop-types";
import "./styles.css";

const ChartCard = ({ title, chart }) => (
  <div className="chart">
    <Card title={title}>{chart}</Card>
  </div>
);

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  chart: PropTypes.element.isRequired,
};

export default ChartCard;