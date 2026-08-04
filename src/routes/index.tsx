import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ChevronRight, Eye, EyeOff, RefreshCw, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/storage";
import { totals } from "@/lib/calc";
import { profileGoals } from "@/lib/goals";
import { daysSinceBackup } from "@/lib/backup";
import { eur, pct, rawPct, sinceLabel } from "@/lib/format";
import { GoalPanel } from "@/components/GoalPanel";
import { PlanDetail, type PlanLineView } from "@/components/PlanDetail";
import { defaultLines } from "@/components/PlanEditor";
import { fetchQuote } from "@/lib/market";
import type { Asset, PlanLine as ProfilePlanLine } from "@/lib/types";

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
  const { profile, assets, setAssets, saveProfile } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | undefined>(undefined);
  const [planOpen, setPlanOpen] = useState(false);

  const t = useMemo(() => totals(assets), [assets]);
  const goals = useMemo(() => profileGoals(profile), [profile]);
  const activeGoal = goals.find((g) => g.id === profile?.activeGoalId) ?? goals[0];
  const dca = activeGoal?.dca ?? 0;
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
    () => buildPlan(profile?.planLines?.length ? profile.planLines : defaultLines(profile?.riskProfile ?? "equilibre"), dca),
    [profile?.planLines, profile?.riskProfile, dca],
  );

  return (
    <div className="fade-up px-4 pt-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Bonjour</p>
          <h1 className="font-display text-2xl">{profile?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mode discret"
            onClick={() => profile && saveProfile({ ...profile, hideAmounts: !profile.hideAmounts })}
            className="tap flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            {profile?.hideAmounts ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="tap flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {sinceLabel(lastUpdate)}
          </button>
        </div>
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
        <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          Actifs {eur(t.actifs)} · Dettes {eur(t.dettes)}
        </p>
      </section>

      <GoalPanel />

      {dca > 0 && (
        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          className="tap card-surface mt-4 flex w-full items-center justify-between p-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck className="size-4 text-primary" />
            Ton plan du mois
          </span>
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            {eur(dca)}
            <ChevronRight className="size-4" />
          </span>
        </button>
      )}

      {needsBackup && (
        <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          {backupAge === undefined
            ? "Pense à exporter une sauvegarde (Profil → Vos données)."
            : `Dernière sauvegarde il y a ${backupAge} j — un export te met à l'abri (Profil).`}
        </p>
      )}

      {planOpen && profile && (
        <PlanDetail
          plan={plan}
          dca={dca}
          profile={profile}
          saveProfile={saveProfile}
          onClose={() => setPlanOpen(false)}
        />
      )}
    </div>
  );
}

function buildPlan(lines: ProfilePlanLine[], dca: number): PlanLineView[] {
  const total = lines.reduce((sum, l) => sum + Math.max(0, l.weight), 0);
  if (total <= 0) return [];
  return lines
    .filter((l) => l.weight > 0)
    .map((l) => ({
      emoji: l.emoji ?? "📈",
      label: l.label,
      tag: rawPct((l.weight / total) * 100, 0),
      amount: Math.round((dca * l.weight) / total),
    }));
}
