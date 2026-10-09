import { getEventoDetalheEntries } from "../../utils/eventoLabels";

interface EventoDetalhesCellProps {
  detalhes: Record<string, unknown> | null | undefined;
}

export default function EventoDetalhesCell({ detalhes }: EventoDetalhesCellProps) {
  const entries = getEventoDetalheEntries(detalhes);

  if (entries.length === 0) {
    return <span className="historico-detalhes-empty">—</span>;
  }

  return (
    <dl className="historico-detalhes">
      {entries.map((entry) => (
        <div key={entry.key} className="historico-detalhe-item">
          <dt>{entry.label}</dt>
          <dd title={entry.value}>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}
