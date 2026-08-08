import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  allocationByType,
  diversificationScore,
  lookThrough,
  REGION_BUCKETS,
} from "@/lib/calc";
import { eur, rawPct } from "@/lib/format";
import { portfolioExposure } from "@/lib/diversification";

/** Palette des secteurs, dans l'ordre d'affichage. */
const SECTOR_COLORS = [
  "#007AFF",
  "#34C759",
  "#AF52DE",
  "#FF9500",
  "#5AC8FA",
  "#FFCC00",
  "#FF3B30",
  "#5856D6",
  "#8E8E93",
  "#00C7BE",
];
import { TYPE_LABELS, type Asset, type AssetType } from "@/lib/types";

/** Palette système (type iOS). */
const TYPE_COLORS: Record<AssetType, string> = {
  pea: "#007AFF",
  av: "#AF52DE",
  livret: "#FFCC00",
  immo: "#FF9500",
  crypto: "#5856D6",
  cash: "#5AC8FA",
  autre: "#8E8E93",
  credit: "#FF3B30",
};

const REGION_COLORS: Record<string, string> = {
  "États-Unis": "#007AFF",
  Europe: "#5AC8FA",
  Émergents: "#AF52DE",
  Japon: "#FF9500",
  "Autres dév.": "#8E8E93",
  Commodities: "#FFCC00",
  "Fonds €": "#34C759",
};

function scoreTone(v: number): string {
  if (v >= 55) return "text-primary";
  if (v >= 30) return "text-amber";
  return "text-destructive";
}
function scoreText(v: number): string {
  if (v >= 75) return "Excellent";
  if (v >= 55) return "Bon";
  if (v >= 30) return "Moyen";
  return "Faible";
}

type View = "classes" | "regions" | "sectors";

/**
 * Une seule carte pour comprendre où va l'argent : répartition par
 * classe d'actif ou par zone géographique (en transparence des ETF),
 * plus le score de diversification correspondant.
 */
export function AllocationCard({
  assets,
  realSectors,
}: {
  assets: Asset[];
  realSectors?: Map<string, Partial<Record<string, number>>>;
}) {
  const [view, setView] = useState<View>("classes");
  const [showInfo, setShowInfo] = useState(false);

  const byType = useMemo(() => allocationByType(assets), [assets]);
  const byRegion = useMemo(() => {
    const lt = lookThrough(assets);
    return REGION_BUCKETS.filter((r) => lt[r] > 0.5)
      .map((r) => ({ key: r as string, value: lt[r], color: REGION_COLORS[r] ?? "#8E8E93" }))
      .sort((a, b) => b.value - a.value);
  }, [assets]);
  const score = useMemo(() => diversificationScore(assets), [assets]);
  const bySector = useMemo(() => {
    const { sectors } = portfolioExposure(assets, realSectors as never);
    return Object.entries(sectors)
      .filter(([, v]) => v > 0.5)
      .map(([key, value], i) => ({ key, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length]! }))
      .sort((a, b) => b.value - a.value);
  }, [assets, realSectors]);

  const slices =
    view === "sectors"
      ? bySector
      : view === "classes"
      ? byType.map((x) => ({ key: TYPE_LABELS[x.type], value: x.value, color: TYPE_COLORS[x.type] }))
      : byRegion;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const value = view === "classes" ? score.classes : score.regions;

  if (!byType.length) return null;

  return (
    <section className="card-surface mt-4 overflow-hidden">
      <div className="grid grid-cols-3 gap-1 border-b border-border bg-elevated p-1">
        {(["classes", "regions", "sectors"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
              view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {v === "classes" ? "Par classe" : v === "regions" ? "Par région" : "Par secteur"}
          </button>
        ))}
      </div>

      {total <= 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          Ajoute une ligne bourse ou une assurance vie pour voir ta répartition
          géographique.
        </p>
      ) : (
        <div className="p-5">
          <div className="flex items-center gap-5">
            <div className="relative size-[124px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="key"
                    innerRadius="64%"
                    outerRadius="100%"
                    paddingAngle={2}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {slices.map((x) => (
                      <Cell key={x.key} fill={x.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Total</span>
                <span className="font-display text-sm">{eur(total)}</span>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2">
              {slices.slice(0, 6).map((x) => (
                <li key={x.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: x.color }}
                    />
                    <span className="truncate">{x.key}</span>
                  </span>
                  <span className="shrink-0 num text-muted-foreground">
                    {rawPct((x.value / total) * 100, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              Diversification
              <button
                type="button"
                aria-label="Comment ce score est calculé"
                onClick={() => setShowInfo((s) => !s)}
                className={`tap flex size-5 items-center justify-center rounded-full ${
                  showInfo ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"
                }`}
              >
                <Info className="size-3" />
              </button>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className={`font-display text-xl ${scoreTone(value)}`}>{value}</span>
              <span className="text-[11px] text-muted-foreground">/100 · {scoreText(value)}</span>
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${value}%` }}
            />
          </div>
          {showInfo && (
            <p className="mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
              Indice de Herfindahl-Hirschman normalisé : 100 = réparti à parts
              égales, 0 = tout concentré sur une seule case.
              {view === "regions" &&
                " Les ETF sont éclatés en transparence selon leur zone d'exposition réelle."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
