/** Légende du graphe de trajectoire, sans dépendance à recharts. */
export function ChartLegend() {
  const items = [
    { color: "var(--foreground)", label: "Réel" },
    { color: "var(--primary)", label: "Projection" },
    { color: "var(--amber)", label: "Objectif" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
