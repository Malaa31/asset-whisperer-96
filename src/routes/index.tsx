import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarCheck, Check, ChevronRight, Eye, EyeOff, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { requestAddAsset, useApp } from "@/lib/storage";
import { diversificationScore, totals } from "@/lib/calc";
import { profileGoals } from "@/lib/goals";
import { daysSinceBackup } from "@/lib/backup";
import { eur, pct, rawPct, sinceLabel } from "@/lib/format";
import { GoalPanel } from "@/components/GoalPanel";
import { AssetSummary } from "@/components/AssetSummary";
import { contributionDue, currentMonth, maybeNotify } from "@/lib/reminder";
import { lastPriceUpdate, refreshPrices } from "@/lib/prices";
import { PlanDetail } from "@/components/PlanDetail";
import { buildPlanFromHoldings, monthlyDecision } from "@/lib/plan";
import { useAnalyses } from "@/lib/useAnalyses";
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
  const due = contributionDue(profile);
  const backupAge = daysSinceBackup(profile);
  const needsBackup = assets.length > 0 && (backupAge === undefined || backupAge > 30);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await refreshPrices(assets);
      if (next) {
        setAssets(next);
        setLastUpdate(lastPriceUpdate(next));
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Rappel du mois : notification si autorisée (au plus une fois par mois).
  useEffect(() => {
    maybeNotify(profile, dca);
  }, [profile, dca]);

  useEffect(() => {
    const stamps = assets
      .map((a) => a.data["lastPriceUpdate"])
      .filter(Boolean)
      .map(String)
      .sort();
    setLastUpdate(stamps[stamps.length - 1]);
  }, [assets]);

  const { analyses } = useAnalyses(assets, profile?.riskProfile ?? "equilibre");
  const plan = useMemo(
    () => buildPlanFromHoldings(assets, analyses, profile, dca),
    [assets, analyses, profile, dca],
  );
  // Le score de diversification entre dans la décision : un plan qui
  // ne regarde que la performance concentre le portefeuille sans le dire.
  const diversification = useMemo(() => diversificationScore(assets).global, [assets]);
  const decision = useMemo(
    () => monthlyDecision(plan, dca, diversification),
    [plan, dca, diversification],
  );

  return (
    <div className="fade-up px-5 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Bonjour
          </p>
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">
            {profile?.name}
          </h1>
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

      {assets.length === 0 ? (
        <section className="card-surface mt-6 p-6 text-center">
          <p className="font-display text-xl">Ton patrimoine commence ici.</p>
          <p className="mx-auto mt-2 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground">
            Ajoute une première ligne — un ETF, un livret, ton bien — et tout se
            calcule : allocation, projection, plan mensuel.
          </p>
          <button
            type="button"
            onClick={requestAddAsset}
            className="tap mt-5 inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" /> Ajouter une ligne
          </button>
        </section>
      ) : (
      <section className="card-surface mt-6 p-6">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Patrimoine net
        </p>
        <div className="mt-2 font-display text-[2.75rem] leading-none tracking-tight">
          {eur(t.net)}
        </div>
        {t.gain !== 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
            <TrendingUp className="size-3.5" />
            {eur(t.gain)} ({pct((t.gain / Math.max(1, t.actifs - t.gain)) * 100)})
          </div>
        )}
        <p className="mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground">
          Actifs <span className="font-mono text-foreground">{eur(t.actifs)}</span>
          {"  ·  "}
          Dettes <span className="font-mono text-destructive">{eur(t.dettes)}</span>
        </p>
      </section>
      )}

      {assets.length > 0 && <AssetSummary assets={assets} />}

      <GoalPanel />

      {due && dca > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
          <BellRing className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            Versement du mois : <span className="font-semibold">{eur(dca)}</span> à placer.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!profile) return;
              saveProfile({ ...profile, lastContribution: currentMonth() });
              toast.success("Versement noté pour ce mois");
            }}
            className="tap flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            <Check className="size-3" /> Fait
          </button>
        </div>
      )}

      {decision && (
        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          className="tap card-surface mt-4 w-full p-5 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <CalendarCheck className="size-3.5 text-primary" />
                Ce mois-ci
              </p>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug">
                {decision.headline}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {decision.detail}
              </p>
            </div>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </div>
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
          analyses={analyses}
          onClose={() => setPlanOpen(false)}
        />
      )}
    </div>
  );
}

