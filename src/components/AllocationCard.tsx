import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { allocationByType, diversificationScore } from "@/lib/calc";
import { eur, rawPct } from "@/lib/format";
import { TYPE_LABELS, type Asset, type AssetType } from "@/lib/types";

/** Palette système (type iOS) par classe d'actif. */
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

function scoreLabel(v: number): { text: string; cls: string } {
  if (v >= 75) return { text: "Excellent", cls: "text-primary" };
  if (v >= 55) return { text: "Bon", cls: "text-primary" };
  if (v >= 30) return { text: "Moyen", cls: "text-amber" };
  return { text: "Faible", cls: "text-destructive" };
}

export function AllocationCard({ assets }: { assets: Asset[] }) {
  const [showInfo, setShowInfo] = useState(false);
  const alloc = useMemo(() => allocationByType(assets), [assets]);
  const score = useMemo(() => diversificationScore(assets), [assets]);
  const total = alloc.reduce((s, x) => s + x.value, 0);

  if (!alloc.length || total <= 0) return null;
  const label = scoreLabel(score.global);

  return (
    <section className="card-surface mt-4 p-5">
      <h2 className="text-sm font-semibold">Répartition de vos actifs</h2>

      <div className="mt-2 flex items-center gap-4">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={alloc}
                dataKey="value"
                nameKey="type"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {alloc.map((x) => (
                  <Cell key={x.type} fill={TYPE_COLORS[x.type]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground">Actifs</span>
            <span className="font-display text-sm">{eur(total)}</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {alloc.map((x) => (
            <li key={x.type} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[x.type] }}
                />
                <span className="truncate">{TYPE_LABELS[x.type]}</span>
              </span>
              <span className="font-mono text-muted-foreground">
                {rawPct((x.value / total) * 100, 0)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            Score de diversification
            <button
              type="button"
              aria-label="Comment ce score est calculé"
              onClick={() => setShowInfo((v) => !v)}
              className={`tap flex size-5 items-center justify-center rounded-full ${showInfo ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"}`}
            >
              <Info className="size-3" />
            </button>
          </h3>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display text-xl ${label.cls}`}>{score.global}</span>
            <span className="text-[11px] text-muted-foreground">/100 · {label.text}</span>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <ScoreBar label="Classes d'actifs" value={score.classes} />
          <ScoreBar label="Zones géographiques (transparence ETF)" value={score.regions} />
        </div>
        {showInfo && (
          <p className="mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            Indice de Herfindahl-Hirschman normalisé : 100 = réparti à parts
            égales entre les classes (et les régions pour la part actions,
            en transparence des ETF), 0 = tout concentré sur une seule case.
          </p>
        )}
      </div>
    </section>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
