import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { eur } from "@/lib/format";
import type { HistoryPoint } from "@/lib/storage";

export function NetWorthChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center text-xs leading-relaxed text-muted-foreground">
        L&apos;historique se construit au fil de vos mises à jour
      </div>
    );
  }

  const chartData = data.map((point) => ({
    date: point.date,
    label: new Date(point.date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    }),
    value: point.value,
  }));

  return (
    <div className="h-44 w-full" aria-label="Évolution du patrimoine net">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A45C" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#C9A45C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "#8E8E93", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <Tooltip
            contentStyle={{
              background: "#141416",
              border: "1px solid #26262A",
              borderRadius: 12,
              color: "#F5F5F7",
              fontSize: 12,
            }}
            labelStyle={{ color: "#8E8E93", marginBottom: 4 }}
            formatter={(value) => [eur(Number(value)), "Patrimoine net"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#C9A45C"
            strokeWidth={2}
            fill="url(#netWorthFill)"
            activeDot={{ r: 4, fill: "#C9A45C", stroke: "#0A0A0B", strokeWidth: 2 }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
