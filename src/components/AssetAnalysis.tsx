import { useEffect, useMemo, useState } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, TrendingDown, TrendingUp, Minus, X } from "lucide-react";
import { analyze, SIGNAL_LABELS, VERDICT_LABELS, type Analysis, type SignalKind } from "@/lib/signals";
import type { HistoryPoint, HistoryResult } from "@/routes/api/public/history";
import { eur } from "@/lib/format";
import { assetValue } from "@/lib/calc";
import { regionSplit, sectorSplit } from "@/lib/classify";
import { useSectors } from "@/lib/useSectors";
import type { Asset, RiskProfile } from "@/lib/types";

const RANGES = [
  { key: "1a", label: "1 an", months: 12 },
  { key: "3a", label: "3 ans", months: 36 },
  { key: "5a", label: "5 ans", months: 60 },
  { key: "max", label: "Max", months: 0 },
] as const;

const SIGNAL_STYLE: Record<SignalKind, { cls: string; Icon: typeof TrendingUp }> = {
  renforcer: { cls: "text-primary bg-primary/10", Icon: TrendingUp },
  conserver: { cls: "text-muted-foreground bg-elevated", Icon: Minus },
  alleger: { cls: "text-destructive bg-destructive/10", Icon: TrendingDown },
};

/** Niveau de risque déduit de la volatilité annualisée. */
function riskLevel(vol: number): { level: number; label: string; cls: string } {
  if (vol < 5) return { level: 1, label: "Très faible", cls: "bg-primary" };
  if (vol < 10) return { level: 2, label: "Faible", cls: "bg-primary" };
  if (vol < 15) return { level: 3, label: "Modéré", cls: "bg-amber" };
  if (vol < 22) return { level: 4, label: "Élevé", cls: "bg-amber" };
  return { level: 5, label: "Très élevé", cls: "bg-destructive" };
}

/**
 * Fiche d'une ligne cotée : courbe de performance, niveau de risque,
 * tendance et indicateurs de qualité. Les données viennent de la même
 * source que le plan, pour que les deux écrans ne se contredisent pas.
 */
export function AssetAnalysis({
  asset,
  risk,
  onEdit,
  onSell,
  onClose,
}: {
  asset: Asset;
  risk: RiskProfile;
  onEdit: () => void;
  onSell: () => void;
  onClose: () => void;
}) {
  useModalBack(onClose);
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("5a");
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  const ticker = String(asset.data["ticker"] ?? "");

  // Composition de la ligne : la pondération publiée prime, l'estimation
  // par indice sert de repli.
  const realSectors = useSectors([asset]);
  const sectorsAreReal = realSectors.size > 0;
  const toRows = (split: Record<string, number | undefined>) =>
    Object.entries(split)
      .filter(([, v]) => (v ?? 0) > 0.005)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([key, v]) => ({ key, value: (v ?? 0) * 100 }));
  const regions = useMemo(() => toRows(regionSplit(asset)), [asset]);
  const sectors = useMemo(
    () => toRows(sectorSplit(asset, realSectors as never)),
    [asset, realSectors],
  );


  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const q = new URLSearchParams({ symbol: ticker, name: String(asset.data["name"] ?? "") });
        const res = await fetch(`/api/public/history?${q.toString()}`);
        const data = res.ok ? ((await res.json()) as HistoryResult) : null;
        if (cancelled) return;
        setPoints(data?.points ?? []);
        setResolved(data?.resolvedFrom ? data.symbol : undefined);
        setAnalysis(data?.points?.length ? analyze(data.symbol, data.points, risk) : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker, risk, asset.data]);

  const chart = useMemo(() => {
    if (!points?.length) return [];
    const months = RANGES.find((r) => r.key === range)?.months ?? 0;
    const slice = months > 0 ? points.slice(-months) : points;
    const base = slice[0]?.c ?? 1;
    return slice.map((p) => ({
      t: new Date(p.t).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      perf: Math.round((p.c / base - 1) * 1000) / 10,
      c: p.c,
    }));
  }, [points, range]);

  const periodPerf = chart.length ? chart[chart.length - 1]!.perf : 0;
  const months = chart.length;
  const periodLabel =
    months >= 24
      ? `${Math.round(months / 12)} ans`
      : months > 1
        ? `${months} mois`
        : "la période";
  const up = periodPerf >= 0;
  const color = up ? "#1e5c48" : "#b3402e";

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
        >
          <X className="size-4" />
        </button>
        <h2 className="truncate px-2 font-display text-base">
          {String(asset.data["name"] ?? "Ligne")}
        </h2>
        <div className="size-9" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <p className="font-display text-[2rem] leading-none">{eur(assetValue(asset))}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {asset.data["quantity"] ? `${asset.data["quantity"]} × ` : ""}
          {asset.data["currentPrice"] ?? asset.data["prixUnitaire"] ?? "—"} €
          {ticker ? ` · ${ticker}` : ""}
        </p>

        {resolved && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Le ticker « {ticker} » est introuvable : les données affichées
            proviennent de {resolved}. Corrigez le ticker de la ligne pour éviter
            cette recherche à chaque ouverture.
          </p>
        )}

        {!ticker && (
          <p className="mt-5 rounded-xl bg-elevated p-3 text-[13px] text-muted-foreground">
            Ajoute un ticker à cette ligne pour afficher son historique et ses
            indicateurs.
          </p>
        )}

        {ticker && loading && <div className="mt-5 h-52 animate-pulse rounded-xl bg-elevated" />}

        {ticker && !loading && chart.length > 0 && (
          <>
            <div className="mt-5 flex items-baseline gap-2">
              <span
                className="num font-display text-xl"
                style={{ color }}
              >
                {up ? "+" : ""}
                {periodPerf.toFixed(1)} %
              </span>
              <span className="text-[11px] text-muted-foreground">
                {/* Période réellement couverte : l'historique disponible est
                    parfois plus court que la plage demandée. */}
                sur {periodLabel}
              </span>
            </div>

            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "#6c7076", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    width={44}
                    tick={{ fill: "#6c7076", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(0)} %`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e5e5df",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)} %`, "Performance"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="perf"
                    stroke={color}
                    strokeWidth={1.75}
                    fill="url(#perfFill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex gap-1.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`tap flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                    range === r.key ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}

        {ticker && !loading && !analysis && chart.length === 0 && (
          <p className="mt-5 rounded-xl bg-elevated p-3 text-[13px] text-muted-foreground">
            Historique indisponible pour ce ticker.
          </p>
        )}

        {(regions.length > 0 || sectors.length > 0) && (
          <div className="card-surface mt-5 p-4">
            <p className="text-sm font-semibold">Composition</p>
            {regions.length > 0 && (
              <>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Régions
                </p>
                <Bars rows={regions} />
              </>
            )}
            {sectors.length > 0 && (
              <>
                <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Secteurs
                </p>
                <Bars rows={sectors} />
              </>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              {sectorsAreReal
                ? "Pondérations sectorielles publiées par l'émetteur."
                : "Répartition estimée à partir de l'indice suivi."}
            </p>
          </div>
        )}

        {analysis && (
          <>
            <div className="card-surface mt-5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Tendance</span>
                {(() => {
                  const st = SIGNAL_STYLE[analysis.signal];
                  return (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}
                    >
                      <st.Icon className="size-3" />
                      {SIGNAL_LABELS[analysis.signal]}
                    </span>
                  );
                })()}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {analysis.reason}
              </p>
            </div>

            <div className="card-surface mt-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Niveau de risque</span>
                <span className="text-[11px] text-muted-foreground">
                  {riskLevel(analysis.volatility).label} · {analysis.volatility.toFixed(0)} % de
                  volatilité
                </span>
              </div>
              <div className="mt-2.5 flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => {
                  const r = riskLevel(analysis.volatility);
                  return (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i <= r.level ? r.cls : "bg-elevated"}`}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Pire baisse subie : {analysis.maxDrawdown.toFixed(0)} %
              </p>
            </div>

            <div className="card-surface mt-3 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  Qualité du placement
                  <button
                    type="button"
                    aria-label="Méthode de calcul"
                    onClick={() => setShowInfo((v) => !v)}
                    className={`tap flex size-5 items-center justify-center rounded-full ${
                      showInfo ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"
                    }`}
                  >
                    <Info className="size-3" />
                  </button>
                </span>
                <span className="text-[11px] font-bold text-primary">
                  {VERDICT_LABELS[analysis.verdict]}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {analysis.verdictReason}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                <Metric label="Perf/an" value={`${analysis.cagr.toFixed(1)} %`} />
                <Metric label="Sharpe" value={analysis.sharpe.toFixed(2)} />
                <Metric label="Sortino" value={analysis.sortino.toFixed(2)} />
                <Metric label="Calmar" value={analysis.calmar.toFixed(2)} />
              </div>
              {showInfo && (
                <p className="mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
                  Sharpe : rendement au-delà d'un placement sans risque, rapporté
                  à la volatilité totale. Sortino : idem, mais sans pénaliser les
                  hausses. Calmar : performance rapportée à la pire baisse subie.
                  Au-delà de 0,7, le risque est bien rémunéré. Ces indicateurs
                  décrivent le passé et ne constituent pas un conseil en
                  investissement.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          type="button"
          onClick={onEdit}
          className="tap h-12 flex-1 rounded-xl border border-border text-sm font-semibold"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={onSell}
          className="tap h-12 flex-1 rounded-xl border border-destructive/40 text-sm font-semibold text-destructive"
        >
          Vendre / retirer
        </button>
      </footer>
    </div>
  );
}

/** Barres de composition, une ligne par poste. */
function Bars({ rows }: { rows: Array<{ key: string; value: number }> }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 truncate text-[11px]">{r.key}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, r.value)}%` }}
            />
          </span>
          <span className="num w-9 shrink-0 text-right text-[11px] text-muted-foreground">
            {r.value.toFixed(0)} %
          </span>
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-[13px] font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
