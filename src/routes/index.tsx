import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarCheck, Check, ChevronRight, Eye, EyeOff, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/storage";
import { totals } from "@/lib/calc";
import { profileGoals } from "@/lib/goals";
import { daysSinceBackup } from "@/lib/backup";
import { eur, pct, rawPct, sinceLabel } from "@/lib/format";
import { GoalPanel } from "@/components/GoalPanel";
import { AllocationCard } from "@/components/AllocationCard";
import { contributionDue, currentMonth, maybeNotify } from "@/lib/reminder";
import { PlanDetail } from "@/components/PlanDetail";
import { buildPlan, classOf } from "@/lib/plan";
import { optimizePlan } from "@/lib/monthly-plan";
import { useAnalyses } from "@/lib/useAnalyses";
import { useSectors } from "@/lib/useSectors";
import { lastPriceUpdate, refreshPrices } from "@/lib/prices";
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
  const realSectors = useSectors(assets);
  // Moteur d'allocation : budget de risque, cible, contraintes dures et
  // traçabilité de chaque montant.
  const outcome = useMemo(
    () =>
      optimizePlan(assets, analyses, profile, dca, {
        excluded: profile?.planExcluded ?? [],
        included: profile?.planIncluded ?? [],
        ...(profile?.planWeights ? { manual: profile.planWeights } : {}),
        realSectors,
        goal: activeGoal ?? null,
      }),
    [assets, analyses, profile, dca, realSectors, activeGoal],
  );

  const plan = useMemo(
    () =>
      buildPlan(
        assets,
        analyses,
        profile,
        dca,
        profile?.planExcluded ?? [],
        profile?.planWeights,
        realSectors,
        activeGoal ?? null,
      ),
    [assets, analyses, profile, dca, realSectors, activeGoal],
  );

  // Les montants viennent du moteur d'allocation ; l'ancien résultat ne
  // fournit plus que l'état du matelas et le classement par poche.
  const mergedPlan = useMemo(
    () => ({
      ...plan,
      lines: outcome.lines.map((l) => {
        const asset = assets.find((a) => a.id === l.assetId);
        return {
          assetId: l.assetId,
          label: l.label,
          cls: (asset ? classOf(asset) : null) ?? "actions",
          amount: l.amount,
          weight: l.weight,
          ...(asset && analyses.get(asset.id)
            ? { signal: analyses.get(asset.id)!.signal }
            : {}),
        };
      }),
    }),
    [plan, outcome, assets, analyses],
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
          Actifs <span className="num text-foreground">{eur(t.actifs)}</span>
          {"  ·  "}
          Dettes <span className="num text-destructive">{eur(t.dettes)}</span>
        </p>
      </section>

      {assets.length > 0 && <AllocationCard assets={assets} realSectors={realSectors} />}

      {plan.buffer.months !== undefined && !plan.buffer.sufficient && (
        <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          Épargne de précaution : {plan.buffer.months.toFixed(1)} mois sur{" "}
          {plan.buffer.threshold} recommandés.
        </p>
      )}

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
          <span className="flex items-center gap-1 num text-xs text-muted-foreground">
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
          plan={mergedPlan}
          dca={dca}
          profile={profile}
          analyses={analyses}
          outcome={outcome}
          assets={assets}
          onToggle={(id) => {
            // Une ligne du plan qu'on retire part dans les exclusions ;
            // une ligne absente qu'on ajoute passe dans les inclusions,
            // que le moteur exempte du filtre de redondance.
            const excluded = profile.planExcluded ?? [];
            const included = profile.planIncluded ?? [];
            const inPlan = outcome.lines.some((l) => l.assetId === id);
            saveProfile({
              ...profile,
              planExcluded: inPlan ? [...excluded, id] : excluded.filter((x) => x !== id),
              planIncluded: inPlan ? included.filter((x) => x !== id) : [...included, id],
            });
          }}
          onWeights={(w) => {
            const { planWeights: _drop, ...rest } = profile;
            saveProfile(w ? { ...rest, planWeights: w } : rest);
          }}
          onClose={() => setPlanOpen(false)}
        />
      )}
    </div>
  );
}

