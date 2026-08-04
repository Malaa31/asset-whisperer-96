import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/storage";
import { totals } from "@/lib/calc";
import { profileGoals } from "@/lib/goals";
import { daysSinceBackup } from "@/lib/backup";
import { TARGET_ALLOCATIONS, type RiskProfile } from "@/lib/types";
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
  const goals = useMemo(() => profileGoals(profile), [profile]);
  const activeGoal = goals.find((g) => g.id === profile?.activeGoalId) ?? goals[0];
  const goal = { dca: activeGoal?.dca ?? 0 };
  const backupAge = daysSinceBackup(profile);
  const needsBackup = assets.length > 0 && (backupAge === undefined || backupAge > 30);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const priced = assets.filter((a) => a.type === "pea" || a.type === "crypto");
      const quotes = await fetchQuote(priced.map((a) => String(a.data["ticker"] ?? "")));
      if (Object.keys(quotes).length) {
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
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const stamps = assets
      .map((a) => a.data["lastPriceUpdate"])
      .filter(Boolean)
      .map(String)
      .sort();
    setLastUpdate(stamps[stamps.length - 1]);
  }, [assets]);

  const plan = useMemo(
    () => buildPlan(profile?.riskProfile ?? "equilibre", goal.dca),
    [profile?.riskProfile, goal.dca],
  );

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

      {needsBackup && (
        <div className="mt-4 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-xs text-muted-foreground">
          {backupAge === undefined
            ? "Vos données ne vivent que sur cet appareil. Pensez à exporter une sauvegarde depuis l'onglet Profil."
            : `Dernière sauvegarde il y a ${backupAge} jours. Un export rapide depuis l'onglet Profil vous met à l'abri.`}
        </div>
      )}

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

function buildPlan(risk: RiskProfile, dca: number): PlanLine[] {
  // Répartition alignée sur l'allocation cible du profil de risque :
  // actions (Monde / Europe / small caps), fonds €, immo papier, cash.
  const a = TARGET_ALLOCATIONS[risk] ?? TARGET_ALLOCATIONS.equilibre;
  const actions = a.actions;
  const weights: Array<[PlanLine, number]> = [
    [{ emoji: "🌍", label: "ETF Monde", tag: "CŒUR", amount: 0 }, actions * 0.6],
    [{ emoji: "🇪🇺", label: "Stoxx Europe 600", tag: "+", amount: 0 }, actions * 0.25],
    [{ emoji: "🐣", label: "Small caps (Russell 2000)", tag: "+", amount: 0 }, actions * 0.15],
    [{ emoji: "🏦", label: "Fonds € (AV)", tag: "SÉCU", amount: 0 }, a.obligations],
    [{ emoji: "🏠", label: "SCPI / immo papier", tag: "+", amount: 0 }, a.immo],
    [{ emoji: "💧", label: "Livret (précaution)", tag: "SÉCU", amount: 0 }, a.cash],
  ];
  const active = weights.filter(([, w]) => w > 0);
  const total = active.reduce((sum, [, w]) => sum + w, 0);
  return active.map(([line, w]) => ({ ...line, amount: Math.round((dca * w) / total) }));
}
