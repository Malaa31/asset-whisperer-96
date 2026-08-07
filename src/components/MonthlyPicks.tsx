import { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useApp } from "@/lib/storage";
import { assetValue } from "@/lib/calc";
import { eur } from "@/lib/format";
import { analyze, SIGNAL_LABELS, type Analysis, type SignalKind } from "@/lib/signals";
import type { HistoryResult } from "@/routes/api/public/history";
import type { Asset } from "@/lib/types";

const SIGNAL_STYLE: Record<SignalKind, { cls: string; Icon: typeof TrendingUp }> = {
  renforcer: { cls: "text-primary bg-primary/10", Icon: TrendingUp },
  conserver: { cls: "text-muted-foreground bg-elevated", Icon: Minus },
  alleger: { cls: "text-destructive bg-destructive/10", Icon: TrendingDown },
};

interface Row {
  asset: Asset;
  analysis: Analysis;
  value: number;
}

/**
 * Valeurs du mois.
 *
 * Le classement ne porte que sur les lignes déjà détenues : aucune
 * valeur extérieure n'est suggérée. Cinq au maximum, ordonnées par un
 * score qui combine performance lissée, risque et tendance, pondéré
 * selon le profil de l'utilisateur.
 */
export function MonthlyPicks() {
  const { assets, profile } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  const tracked = useMemo(
    () =>
      assets.filter(
        (a) => (a.type === "pea" || a.type === "crypto") && String(a.data["ticker"] ?? "").trim(),
      ),
    [assets],
  );

  const risk = profile?.riskProfile ?? "equilibre";

  useEffect(() => {
    if (!tracked.length) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    void Promise.all(
      tracked.map(async (asset) => {
        try {
          const symbol = String(asset.data["ticker"]);
          const res = await fetch(`/api/public/history?symbol=${encodeURIComponent(symbol)}`);
          if (!res.ok) return null;
          const data = (await res.json()) as HistoryResult;
          const analysis = analyze(symbol, data.points ?? [], risk);
          return analysis ? { asset, analysis, value: assetValue(asset) } : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const list = results.filter((r): r is Row => r !== null);
      list.sort((a, b) => b.analysis.score - a.analysis.score);
      setRows(list.slice(0, 5));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tracked, risk]);

  if (rows !== null && !rows.length && !loading) {
    return (
      <section className="card-surface mt-4 p-5">
        <h2 className="text-sm font-semibold">Valeurs du mois</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {tracked.length
            ? "Historique insuffisant sur tes lignes : il faut au moins deux ans de cotation pour calculer une performance lissée."
            : "Ajoute des lignes bourse ou crypto avec leur ticker pour voir leurs indicateurs."}
        </p>
      </section>
    );
  }

  return (
    <section className="card-surface mt-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Valeurs du mois
          <button
            type="button"
            aria-label="Méthode de calcul"
            onClick={() => setShowMethod((s) => !s)}
            className={`tap flex size-5 items-center justify-center rounded-full ${
              showMethod ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"
            }`}
          >
            <Info className="size-3" />
          </button>
        </h2>
        {loading && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">
        Tes propres lignes, classées selon ton profil {risk}.
      </p>

      {showMethod && (
        <p className="mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
          Score composite sur trois dimensions, calculées depuis le début de
          l'historique disponible : performance annualisée lissée, risque
          (volatilité et pire baisse), tendance (position du cours face à sa
          moyenne 12 mois). Les pondérations suivent ton profil — un profil
          prudent valorise la régularité, un profil offensif la performance.
          Ces indicateurs décrivent le passé, ne prédisent rien et ne
          constituent pas un conseil en investissement.
        </p>
      )}

      {loading && !rows && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-elevated" />
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-2.5">
        {(rows ?? []).map(({ asset, analysis, value }, i) => {
          const style = SIGNAL_STYLE[analysis.signal];
          return (
            <li key={asset.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">
                      {String(asset.data["name"] ?? analysis.symbol)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {eur(value)} · {analysis.years.toFixed(0)} ans d'historique
                    </p>
                  </div>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${style.cls}`}
                >
                  <style.Icon className="size-3" />
                  {SIGNAL_LABELS[analysis.signal]}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center">
                <Stat label="Perf/an" value={`${analysis.cagr.toFixed(1)} %`} />
                <Stat label="Volatilité" value={`${analysis.volatility.toFixed(0)} %`} />
                <Stat label="Score" value={String(analysis.score)} strong />
              </div>

              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {analysis.reason}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
        Indicateurs calculés sur l'historique passé. Ils ne préjugent pas des
        performances futures et ne constituent pas un conseil en investissement.
      </p>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className={`font-mono text-[13px] ${strong ? "font-bold text-primary" : ""}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
