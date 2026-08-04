import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrajectoryPoint } from "@/lib/goals";
import { eur } from "@/lib/format";

const AXIS = "oklch(0.55 0.01 270)";
const GRID = "oklch(0.9 0.004 260)";

function compact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")} M€`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} k€`;
  return `${Math.round(v)} €`;
}

export function TrajectoryChart({ data }: { data: TrajectoryPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="2 6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            width={52}
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={compact}
          />
          <Tooltip
            cursor={{ stroke: GRID, strokeWidth: 1 }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              padding: "8px 10px",
            }}
            labelStyle={{ color: AXIS, marginBottom: 4 }}
            formatter={(v: number, name: string) => [eur(v), name]}
          />
          <Area
            type="monotone"
            dataKey="projection"
            name="Projection"
            stroke="var(--primary)"
            strokeWidth={1.75}
            fill="url(#projFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="objectif"
            name="Objectif"
            stroke="var(--amber)"
            strokeWidth={1.25}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="reel"
            name="Réel"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--foreground)", stroke: "none" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

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
