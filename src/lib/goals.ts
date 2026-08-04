import type { Asset, AssetType, Goal, GoalKind } from "./types";
import { assetValue, project, totals } from "./calc";
import { uid } from "./storage";

export const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  patrimoine: "Patrimoine global",
  enveloppe: "Une enveloppe",
  immo: "Achat immobilier",
  libre: "Objectif libre",
};

export const GOAL_KIND_HINTS: Record<GoalKind, string> = {
  patrimoine: "Atteindre X € de patrimoine net",
  enveloppe: "Ex. 100 000 € d'actifs sur le PEA",
  immo: "Constituer l'apport d'une maison",
  libre: "Tout autre projet chiffré",
};

export const ENVELOPE_OPTIONS: Array<{ value: AssetType; label: string }> = [
  { value: "pea", label: "Bourse (PEA / CTO)" },
  { value: "av", label: "Assurance vie" },
  { value: "livret", label: "Livrets" },
  { value: "crypto", label: "Crypto" },
  { value: "immo", label: "Immobilier" },
  { value: "cash", label: "Cash" },
];

const LIQUID: AssetType[] = ["pea", "av", "livret", "cash", "crypto"];

/** Valeur actuelle correspondant au périmètre de l'objectif. */
export function goalCurrent(assets: Asset[], goal: Goal): number {
  switch (goal.kind) {
    case "patrimoine":
      return totals(assets).net;
    case "immo":
      return assets
        .filter((a) => LIQUID.includes(a.type))
        .reduce((s, a) => s + assetValue(a), 0);
    case "enveloppe": {
      const scope = goal.scope;
      if (!scope) return totals(assets).net;
      return assets.filter((a) => a.type === scope).reduce((s, a) => s + assetValue(a), 0);
    }
    default:
      return totals(assets).net;
  }
}

export interface TrajectoryPoint {
  annee: number;
  label: string;
  reel?: number;
  projection?: number;
  objectif: number;
}

/**
 * Série pour le graphe : historique réel (si dispo) puis projection,
 * avec la ligne d'objectif constante.
 */
export function buildTrajectory(
  current: number,
  goal: Goal,
  history: Array<{ date: string; value: number }> = [],
): TrajectoryPoint[] {
  const rate = (goal.rate ?? 7.5) / 100;
  const proj = project(current, goal.dca, Math.max(1, goal.horizon), rate);
  const points: TrajectoryPoint[] = proj.map((p) => ({
    annee: p.annee,
    label: p.annee === 0 ? "Auj." : `+${p.annee} an${p.annee > 1 ? "s" : ""}`,
    projection: p.valeur,
    objectif: goal.amount,
  }));
  if (points[0]) points[0].reel = current;
  // les points historiques sont rattachés à l'année 0 (courbe réelle courte)
  if (history.length > 1 && points[0]) {
    points[0].reel = history[history.length - 1]?.value ?? current;
  }
  return points;
}

/** Année (entière) où la projection franchit l'objectif, sinon undefined. */
export function crossingYear(points: TrajectoryPoint[], amount: number): number | undefined {
  return points.find((p) => (p.projection ?? 0) >= amount && amount > 0)?.annee;
}

export function newGoal(kind: GoalKind = "patrimoine"): Goal {
  return {
    id: uid(),
    kind,
    label:
      kind === "immo"
        ? "Apport maison"
        : kind === "enveloppe"
          ? "100 000 € sur le PEA"
          : "Patrimoine cible",
    amount: kind === "enveloppe" ? 100000 : kind === "immo" ? 60000 : 500000,
    horizon: 10,
    dca: 500,
    rate: 7.5,
    ...(kind === "enveloppe" ? { scope: "pea" as const } : {}),
  };
}

export function goalProgress(assets: Asset[], goal: Goal): number {
  if (!goal.amount) return 0;
  return Math.max(0, Math.min(100, (goalCurrent(assets, goal) / goal.amount) * 100));
}
