import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { SIGNAL_LABELS, VERDICT_LABELS, type Analysis, type SignalKind } from "@/lib/signals";

const STYLE: Record<SignalKind, { cls: string; Icon: typeof TrendingUp }> = {
  renforcer: { cls: "text-primary bg-primary/10", Icon: TrendingUp },
  conserver: { cls: "text-muted-foreground bg-elevated", Icon: Minus },
  alleger: { cls: "text-destructive bg-destructive/10", Icon: TrendingDown },
};

/**
 * Analyse d'une ligne, affichée dans son détail.
 * Le verdict répond à « ce placement a-t-il bien travaillé ? » — jugé
 * sur le rendement rapporté au risque, et sur l'alpha quand un marché
 * de référence est disponible : monter dans un marché qui monte n'est
 * pas une performance.
 */
export function AssetAnalysis({ analysis }: { analysis: Analysis }) {
  const style = STYLE[analysis.signal];

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Analyse</h3>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${style.cls}`}
        >
          <style.Icon className="size-3" />
          {SIGNAL_LABELS[analysis.signal]}
        </span>
      </div>

      <p className="mt-3 text-[13px] font-semibold">
        {VERDICT_LABELS[analysis.verdict]}
        {analysis.alpha !== undefined && (
          <span className="ml-1.5 num text-[11px] font-normal text-muted-foreground">
            alpha {analysis.alpha > 0 ? "+" : ""}
            {analysis.alpha.toFixed(1)} %/an
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {analysis.verdictReason}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <Metric label="Perf/an" value={`${analysis.cagr.toFixed(1)} %`} />
        <Metric label="Volatilité" value={`${analysis.volatility.toFixed(0)} %`} />
        <Metric label="Pire baisse" value={`${analysis.maxDrawdown.toFixed(0)} %`} />
        <Metric label="Sharpe" value={analysis.sharpe.toFixed(2)} />
        <Metric label="Sortino" value={analysis.sortino.toFixed(2)} />
        <Metric
          label="Bêta"
          value={analysis.beta !== undefined ? analysis.beta.toFixed(2) : "—"}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {analysis.reason}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Calculé sur {analysis.years.toFixed(0)} ans d'historique. Ces indicateurs
        décrivent le passé et ne constituent pas un conseil en investissement.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-[13px]">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
