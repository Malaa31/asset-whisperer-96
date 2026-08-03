import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApp } from "@/lib/storage";
import { lookThrough, REGION_BUCKETS, totals } from "@/lib/calc";
import { eur, rawPct } from "@/lib/format";

export const Route = createFileRoute("/pilotage")({
  head: () => ({
    meta: [
      { title: "Pilotage — Allocation et risques" },
      {
        name: "description",
        content: "Allocation en transparence, jauges de protection et simulateurs de crédit.",
      },
      { property: "og:title", content: "Pilotage — Allocation et risques" },
      {
        property: "og:description",
        content: "Allocation en transparence, jauges de protection et simulateurs de crédit.",
      },
    ],
  }),
  component: Pilotage,
});

const COLORS: Record<string, string> = {
  "États-Unis": "bg-primary",
  Europe: "bg-info",
  Émergents: "bg-violet",
  Japon: "bg-orange",
  "Autres dév.": "bg-muted-foreground",
  Commodities: "bg-amber",
  "Fonds €": "bg-destructive",
};

function Pilotage() {
  const { assets } = useApp();
  const alloc = useMemo(() => lookThrough(assets), [assets]);
  const t = useMemo(() => totals(assets), [assets]);
  const sum = Object.values(alloc).reduce((s, v) => s + v, 0);

  return (
    <div className="fade-up px-4 pt-6">
      <h1 className="font-display text-2xl">Pilotage</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Allocation réelle en transparence (look-through).
      </p>

      <section className="card-surface mt-5 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Allocation actuelle</h2>
          <span className="font-mono text-xs text-muted-foreground">{eur(sum)}</span>
        </div>
        <div className="mt-4 space-y-3">
          {REGION_BUCKETS.map((r) => {
            const v = alloc[r];
            const p = sum ? (v / sum) * 100 : 0;
            if (!v) return null;
            return (
              <div key={r}>
                <div className="flex justify-between text-xs">
                  <span>{r}</span>
                  <span className="font-mono text-muted-foreground">
                    {rawPct(p)} · {eur(v)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${COLORS[r]}`}
                    style={{ width: `${p}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!sum && (
            <p className="text-sm text-muted-foreground">
              Ajoute des lignes bourse ou une assurance vie pour voir ton allocation.
            </p>
          )}
        </div>
      </section>

      <section className="card-surface mt-4 p-5">
        <h2 className="text-sm font-semibold">Synthèse</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-mono">{eur(t.actifs)}</div>
            <div className="text-[11px] text-muted-foreground">Actifs</div>
          </div>
          <div>
            <div className="font-mono text-destructive">{eur(t.dettes)}</div>
            <div className="text-[11px] text-muted-foreground">Dettes</div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Jauges de protection, scénarios de stress et simulateurs de crédit arrivent à l'étape
          suivante.
        </p>
      </section>
    </div>
  );
}
