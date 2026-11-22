import { createFileRoute, Link } from "@tanstack/react-router";
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

  return (
    <main className="fade-up flex flex-col gap-5 px-5 pb-6 pt-7">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Bonjour,</p>
          <h1 className="font-display text-2xl leading-tight tracking-tight">{profile?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mode discret"
            onClick={() => profile && saveProfile({ ...profile, hideAmounts: !profile.hideAmounts })}
            className="tap flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
          >
            {profile?.hideAmounts ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            aria-label={`Actualiser les cours — ${sinceLabel(lastUpdate)}`}
            onClick={() => void refresh()}
            className="tap flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/10" aria-labelledby="net-worth-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="net-worth-title" className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">Patrimoine net</p>
            <p className="mt-3 font-display text-[2.65rem] leading-none tracking-tight sm:text-5xl">{eur(t.net)}</p>
          </div>
          {t.gain !== 0 && (
            <span className={`mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold ${t.gain >= 0 ? "bg-success/20 text-primary-foreground" : "bg-destructive/20 text-primary-foreground"}`}>
              <TrendingUp className="size-3.5" />
              {pct((t.gain / Math.max(1, t.actifs - t.gain)) * 100)}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs opacity-75">{sinceLabel(lastUpdate)}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-primary-foreground/20 pt-4">
          <div><p className="text-[11px] opacity-70">Actifs</p><p className="mt-1 num text-sm font-semibold">{eur(t.actifs)}</p></div>
          <div><p className="text-[11px] opacity-70">Dettes</p><p className="mt-1 num text-sm font-semibold">{eur(t.dettes)}</p></div>
        </div>
      </section>

      <section aria-label="Indicateurs clés" className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4"><p className="text-xs text-muted-foreground">Lignes suivies</p><p className="mt-2 font-display text-2xl">{assets.length}</p><p className="mt-1 text-[11px] text-muted-foreground">dans votre patrimoine</p></div>
        <div className="card-surface p-4"><p className="text-xs text-muted-foreground">Versement mensuel</p><p className="mt-2 font-display text-2xl">{eur(dca)}</p><p className="mt-1 text-[11px] text-muted-foreground">objectif en cours</p></div>
      </section>

      {assets.length > 0 && <AllocationCard assets={assets} realSectors={realSectors} />} 

      {outcome.buffer.months !== undefined && !outcome.buffer.sufficient && (
        <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          Épargne de précaution : {outcome.buffer.months.toFixed(1)} mois sur{" "}
          {outcome.buffer.threshold} recommandés.
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
        <Link
          to="/plan"
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
        </Link>
      )}

      {needsBackup && (
        <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          {backupAge === undefined
            ? "Pense à exporter une sauvegarde (Profil → Vos données)."
            : `Dernière sauvegarde il y a ${backupAge} j — un export te met à l'abri (Profil).`}
        </p>
      )}

</main>
  );
}

