import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useApp } from "@/lib/storage";
import { profileGoals } from "@/lib/goals";
import { optimizePlan } from "@/lib/monthly-plan";
import { useAnalyses } from "@/lib/useAnalyses";
import { useSectors } from "@/lib/useSectors";
import { PlanDetail } from "@/components/PlanDetail";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan du mois — Patrimoine" },
      {
        name: "description",
        content: "Où placer votre versement du mois, ligne par ligne, selon votre profil et votre objectif.",
      },
      { property: "og:title", content: "Plan du mois — Patrimoine" },
      {
        property: "og:description",
        content: "Où placer votre versement du mois, ligne par ligne, selon votre profil et votre objectif.",
      },
    ],
  }),
  component: PlanPage,
});

/**
 * Le plan est une page, plus une couche posée par-dessus l'accueil.
 *
 * Monté en surimpression, il devait simuler une entrée d'historique pour
 * survivre au geste de retour ; à la moindre superposition, ce faux-semblant
 * renvoyait l'utilisateur sur un autre onglet. Une vraie route règle la
 * question : le retour du téléphone fait ce qu'il annonce.
 */
function PlanPage() {
  const navigate = useNavigate();
  const { profile, assets, saveProfile } = useApp();
  const goals = useMemo(() => profileGoals(profile), [profile]);
  const activeGoal = goals.find((g) => g.id === profile?.activeGoalId) ?? goals[0];
  const dca = activeGoal?.dca ?? 0;

  const { analyses } = useAnalyses(assets, profile?.riskProfile ?? "equilibre");
  const realSectors = useSectors(assets);

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

  // Une feuille plein écran : la barre d'onglets et le bouton d'ajout
  // n'ont rien à faire par-dessus.
  useEffect(() => {
    document.body.dataset["sheet"] = "1";
    return () => {
      delete document.body.dataset["sheet"];
    };
  }, []);

  const close = () => {
    void navigate({ to: "/" });
  };

  if (!profile) {
    close();
    return null;
  }

  return (
    <PlanDetail
      dca={dca}
      profile={profile}
      analyses={analyses}
      outcome={outcome}
      assets={assets}
      onToggle={(id) => {
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
        const next = { ...profile };
        if (w) next.planWeights = w;
        else delete next.planWeights;
        saveProfile(next);
      }}
      onClose={close}
    />
  );
}
