import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/storage";
import { totals } from "@/lib/calc";
import { eur, pct, sinceLabel } from "@/lib/format";
import { GoalPanel } from "@/components/GoalPanel";
import { fetchQuote } from "@/lib/market";
import type { Asset } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Patrimoine" },
      {
        name: "description",
        content: "Votre patrimoine net, votre objectif et votre plan d'investissement du mois.",
      },
      { property: "og:title", content: "Accueil — Patrimoine" },
      {
        property: "og:description",
        content: "Votre patrimoine net, votre objectif et votre plan d'investissement du mois.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, assets, setAssets } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | undefined>(undefined);

  const t = useMemo(() => totals(assets), [assets]);
  const goal = profile?.goal ?? { amount: 0, horizon: 10, dca: 0 };

  const refresh = async () => {
    setRefreshing(true);
    const priced = assets.filter((a) => a.type === "pea" || a.type === "crypto");
    const quotes = await fetchQuote(priced.map((a) => String(a.data["ticker"] ?? "")));
    const stamp = new Date().toISOString();
    const next: Asset[] = assets.map((a) => {
      const ticker = String(a.data["ticker"] ?? "");
      const q = quotes[ticker];
      if (!q) return a;
      const key = a.type === "crypto" ? "prixUnitaire" : "currentPrice";
      return { ...a, data: { ...a.data, [key]: q.price, lastPriceUpdate: stamp }, updatedAt: stamp };
    });
    setAssets(next);
    setLastUpdate(stamp);
    setRefreshing(false);
  };

  useEffect(() => {
    const stamps = assets
      .map((a) => a.data["lastPriceUpdate"])
      .filter(Boolean)
      .map(String)
      .sort();
    setLastUpdate(stamps[stamps.length - 1]);
  }, [assets]);

  const plan = useMemo(() => buildPlan(assets, goal.dca), [assets, goal.dca]);

  return (
    <div className="fade-up px-4 pt-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Bonjour</p>
          <h1 className="font-display text-2xl">{profile?.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="tap flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {sinceLabel(lastUpdate)}
        </button>
      </header>

      <section className="card-surface mt-5 p-5">
        <p className="text-xs text-muted-foreground">Patrimoine net</p>
        <div className="mt-1 font-display text-4xl">{eur(t.net)}</div>
        {t.gain !== 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
            <TrendingUp className="size-3.5" />
            {eur(t.gain)} ({pct((t.gain / Math.max(1, t.actifs - t.gain)) * 100)})
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <Stat label="Actifs" value={eur(t.actifs)} />
          <Stat label="Dettes" value={eur(t.dettes)} tone="text-destructive" />
          <Stat label="Lignes" value={String(assets.length)} />
        </div>
      </section>

      <GoalPanel />

      {goal.dca > 0 && (
        <section className="mt-4 rounded-2xl border border-primary/35 bg-primary/8 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Où mettre tes {eur(goal.dca)} ce mois-ci</h2>
            <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              AGIR
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {plan.map((p) => (
              <li key={p.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{p.emoji}</span>
                    <span className="truncate">{p.label}</span>
                    <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {p.tag}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{eur(p.amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(p.amount / Math.max(1, goal.dca)) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`font-mono text-sm ${tone ?? ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

interface PlanLine {
  emoji: string;
  label: string;
  tag: string;
  amount: number;
}

function buildPlan(assets: Asset[], dca: number): PlanLine[] {
  const hasWorld = assets.some((a) => /world|monde/i.test(String(a.data["name"] ?? "")));
  const weights: Array<[PlanLine, number]> = [
    [{ emoji: "🌍", label: "ETF Monde", tag: "CŒUR", amount: 0 }, 40],
    [
      { emoji: "🇺🇸", label: "S&P 500", tag: hasWorld ? "STOP" : "+", amount: 0 },
      hasWorld ? 0 : 15,
    ],
    [{ emoji: "🇪🇺", label: "Stoxx Europe 600", tag: "+", amount: 0 }, 20],
    [{ emoji: "🛢️", label: "Commodities (CMSE)", tag: "NEW", amount: 0 }, 12],
    [{ emoji: "🏦", label: "Fonds € (AV)", tag: "NEW", amount: 0 }, 18],
    [{ emoji: "🐣", label: "Small caps (Russell 2000)", tag: "NEW", amount: 0 }, 10],
  ];
  const active = weights.filter(([, w]) => w > 0);
  const total = active.reduce((s, [, w]) => s + w, 0);
  return active.map(([line, w]) => ({ ...line, amount: Math.round((dca * w) / total) }));
}
