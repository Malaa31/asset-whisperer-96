import { assetValue } from "./calc";
import { regionSplit, sectorSplit } from "./classify";
import type { Analysis } from "./signals";
import type { Asset, Goal, Profile, RiskProfile } from "./types";

/**
 * Moteur du plan de versement mensuel.
 *
 * Il ne connaît aucun actif par son nom : il consomme les métriques
 * déjà calculées — volatilité, pire baisse, échelle réglementaire,
 * signal composite, composition géographique — et raisonne en
 * expositions. Un ETF monde compte donc partiellement dans chaque zone
 * qu'il contient, faute de quoi un portefeuille monde plus S&P 500
 * paraîtrait diversifié alors qu'il est massivement américain.
 *
 * L'enchaînement est fixe et aucune étape ne peut être sautée :
 *   profil → budget de risque → allocation cible → écart au réel
 *   → inclinaison par les signaux → contraintes dures → arrondis.
 */

// ─────────────────────────────────────────────────────────────────────
// 1. Budget de risque
// ─────────────────────────────────────────────────────────────────────

export interface RiskBudget {
  /** Volatilité de portefeuille visée, en pourcentage. */
  sigmaTarget: number;
  /** Pire baisse tolérée, en pourcentage. */
  ddTolerance: number;
  /** Horizon retenu, en années, si l'âge est connu. */
  horizon?: number;
}

const BASE_BUDGET: Record<RiskProfile, { sigma: number; dd: number }> = {
  prudent: { sigma: 5, dd: 10 },
  equilibre: { sigma: 9, dd: 15 },
  dynamique: { sigma: 13, dd: 22 },
  offensif: { sigma: 18, dd: 35 },
};

/**
 * Budget de risque déduit du profil, modulé par l'horizon quand l'âge
 * est renseigné : un horizon long permet d'absorber davantage de
 * variations. Sans âge, aucune modulation n'est appliquée plutôt que
 * d'inventer une durée.
 */
export function riskBudgetFromProfile(profile: Profile | null): RiskBudget {
  const risk = profile?.riskProfile ?? "equilibre";
  const base = BASE_BUDGET[risk] ?? BASE_BUDGET.equilibre;
  const age = Number(profile?.age ?? 0);
  if (!age || age <= 0 || age >= 100) {
    return { sigmaTarget: base.sigma, ddTolerance: base.dd };
  }
  const horizon = Math.max(5, 65 - age);
  const factor = Math.min(1.2, 0.7 + horizon / 50);
  return { sigmaTarget: base.sigma * factor, ddTolerance: base.dd, horizon };
}

// ─────────────────────────────────────────────────────────────────────
// 2. Expositions agrégées
// ─────────────────────────────────────────────────────────────────────

export interface Exposures {
  byZone: Record<string, number>;
  bySector: Record<string, number>;
  /** Valeur totale servant de dénominateur. */
  total: number;
}

/** Expositions en transparence, en parts de la valeur totale. */
export function aggregateExposures(
  portfolio: Asset[],
  realSectors?: Map<string, Partial<Record<string, number>>>,
): Exposures {
  const byZone: Record<string, number> = {};
  const bySector: Record<string, number> = {};
  let total = 0;

  for (const a of portfolio) {
    const v = Math.max(0, assetValue(a));
    if (v <= 0) continue;
    const zones = regionSplit(a);
    const sectors = sectorSplit(a, realSectors as never);
    if (!Object.keys(zones).length && !Object.keys(sectors).length) continue;
    total += v;
    for (const [z, w] of Object.entries(zones)) byZone[z] = (byZone[z] ?? 0) + v * (w ?? 0);
    for (const [s, w] of Object.entries(sectors)) bySector[s] = (bySector[s] ?? 0) + v * (w ?? 0);
  }

  if (total > 0) {
    for (const k of Object.keys(byZone)) byZone[k] = byZone[k]! / total;
    for (const k of Object.keys(bySector)) bySector[k] = bySector[k]! / total;
  }
  return { byZone, bySector, total };
}

// ─────────────────────────────────────────────────────────────────────
// 3. Allocation cible
// ─────────────────────────────────────────────────────────────────────

/** Répartition géographique de référence, à la capitalisation mondiale. */
const ZONE_BASE: Record<string, number> = {
  "États-Unis": 0.62,
  Europe: 0.15,
  Japon: 0.06,
  Émergents: 0.11,
  "Autres dév.": 0.06,
};

export interface TargetAllocation {
  /** Part visée en actions, entre 0 et 1. */
  equityShare: number;
  /** Répartition géographique visée à l'intérieur de la poche actions. */
  byZone: Record<string, number>;
  /** Volatilité moyenne des lignes actions détenues, en pourcentage. */
  equitySigma: number;
}

/**
 * Allocation cible.
 *
 * La part actions découle du budget de risque et de la volatilité
 * réellement observée sur les lignes détenues : viser 13 % de
 * volatilité avec des supports à 18 % impose de ne pas être investi à
 * cent pour cent en actions.
 */
export function targetAllocation(
  profile: Profile | null,
  portfolio: Asset[],
  analyses: Map<string, Analysis>,
): TargetAllocation {
  const budget = riskBudgetFromProfile(profile);

  const equities = portfolio.filter((a) => Object.keys(regionSplit(a)).length > 0);
  const sigmas = equities
    .map((a) => analyses.get(a.id)?.volatility)
    .filter((v): v is number => typeof v === "number" && v > 0);
  // Sans mesure disponible, une volatilité d'actions de référence.
  const equitySigma = sigmas.length ? sigmas.reduce((s, v) => s + v, 0) / sigmas.length : 15;

  const equityShare = Math.max(0, Math.min(1, budget.sigmaTarget / equitySigma));
  const sum = Object.values(ZONE_BASE).reduce((s, v) => s + v, 0);
  const byZone = Object.fromEntries(
    Object.entries(ZONE_BASE).map(([z, w]) => [z, w / sum]),
  );
  return { equityShare, byZone, equitySigma };
}

// ─────────────────────────────────────────────────────────────────────
// 4. Objectif et rendement requis
// ─────────────────────────────────────────────────────────────────────

export interface GoalInsight {
  kind: "none" | "reached" | "unrealistic" | "ok" | "incomplete";
  /** Rendement annuel requis, en pourcentage, si calculable et positif. */
  requiredReturn?: number;
  message?: string;
}

/**
 * Rendement requis pour atteindre l'objectif.
 *
 * Il n'est calculé que si l'objectif et l'horizon sont définis. Un
 * rendement négatif signifie que le capital couvre déjà la cible : on
 * le dit en toutes lettres plutôt que d'afficher un pourcentage négatif,
 * qui n'a aucun sens pour l'utilisateur.
 */
export function goalInsight(
  currentCapital: number,
  goal: Goal | null | undefined,
  budget: RiskBudget,
): GoalInsight {
  if (!goal?.amount || goal.amount <= 0) return { kind: "none" };
  const horizon = goal.horizon ?? budget.horizon;
  if (!horizon || horizon <= 0) {
    return {
      kind: "incomplete",
      message: "Complétez votre profil et votre horizon pour affiner le plan.",
    };
  }
  if (currentCapital <= 0) return { kind: "ok" };

  const required = (Math.pow(goal.amount / currentCapital, 1 / horizon) - 1) * 100;
  if (required <= 0) {
    return {
      kind: "reached",
      message:
        "Votre capital actuel couvre déjà l'objectif sur l'horizon défini. Vous pouvez réduire le risque ou relever l'objectif.",
    };
  }
  if (required > 12) {
    return {
      kind: "unrealistic",
      requiredReturn: required,
      message: `L'objectif suppose ${required.toFixed(1)} % par an, au-delà de ce qu'un portefeuille diversifié procure durablement. Allongez l'horizon ou augmentez le versement.`,
    };
  }
  return {
    kind: "ok",
    requiredReturn: required,
    message: `${required.toFixed(1)} % par an suffisent pour atteindre l'objectif : inutile de prendre plus de risque que nécessaire.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 5. Optimisation et contraintes
// ─────────────────────────────────────────────────────────────────────

export type PlanIntent = "renforcer" | "maintenir" | "alleger";

export interface PlanBreakdown {
  /** Rapprochement de la cible, en euros. */
  convergence: number;
  /** Inclinaison par le signal de marché, en euros. */
  signal: number;
  /** Pénalité de risque, en euros (négative). */
  risk: number;
  /** Ajustement d'arrondi et de frais, en euros. */
  rounding: number;
}

export interface PlanLine {
  assetId: string;
  label: string;
  amount: number;
  weight: number;
  intent: PlanIntent;
  /** Écart à la cible, en points de pourcentage. */
  gap: number;
  breakdown: PlanBreakdown;
}

export interface Violation {
  code: string;
  message: string;
}

export interface PlanOutcome {
  lines: PlanLine[];
  violations: Violation[];
  budget: RiskBudget;
  target: TargetAllocation;
  goal: GoalInsight;
  hhi: number;
  warnings: string[];
}

/** Versement minimal : en deçà, les frais d'ordre dépassent un pour cent. */
const MIN_TICKET = 25;

/** Plafond d'exposition sur une seule zone, part du portefeuille. */
const MAX_ZONE = 0.45;

/** Plafond spécifique aux émergents, à une fois et demie leur poids. */
const MAX_EM = 0.165;

const SRRI_CAP: Record<RiskProfile, number> = {
  prudent: 0,
  equilibre: 0.15,
  dynamique: 0.25,
  offensif: 0.45,
};

/** Intention autorisée par le signal composite de l'actif. */
export function intentFromSignal(score: number | undefined): PlanIntent {
  if (score === undefined) return "maintenir";
  if (score > 0.35) return "renforcer";
  if (score < -0.15) return "alleger";
  return "maintenir";
}

/** Indice de concentration du plan, entre 0 et 1. */
export function herfindahl(lines: Array<{ amount: number }>): number {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (total <= 0) return 0;
  return lines.reduce((s, l) => s + (l.amount / total) ** 2, 0);
}

export interface DiversificationImpact {
  hhi: number;
  level: "diversifie" | "modere" | "concentre";
  warnings: string[];
}

/**
 * Effet du plan sur la diversification.
 * On n'empêche jamais un choix : on en montre le coût.
 */
export function diversificationImpact(
  lines: PlanLine[],
  portfolio: Asset[],
  target: TargetAllocation,
  realSectors?: Map<string, Partial<Record<string, number>>>,
): DiversificationImpact {
  const hhi = herfindahl(lines);
  const level = hhi > 0.4 ? "concentre" : hhi > 0.25 ? "modere" : "diversifie";
  const warnings: string[] = [];

  if (level === "concentre") {
    warnings.push(
      `Concentration : ${lines.length} ligne${lines.length > 1 ? "s" : ""} portent la totalité du versement.`,
    );
  }

  // Exposition projetée après versement, comparée à la cible.
  const after = portfolio.map((a) => {
    const add = lines.find((l) => l.assetId === a.id)?.amount ?? 0;
    return { ...a, data: { ...a.data, __add: add } } as Asset;
  });
  const current = aggregateExposures(portfolio, realSectors);
  const projected = aggregateExposures(after, realSectors);

  for (const [zone, want] of Object.entries(target.byZone)) {
    const now = current.byZone[zone] ?? 0;
    const next = projected.byZone[zone] ?? 0;
    if (want - next > 0.08 && next < now + 0.001) {
      warnings.push(
        `${zone} : ${(next * 100).toFixed(0)} % après versement, contre ${(want * 100).toFixed(0)} % visé.`,
      );
    }
  }
  return { hhi, level, warnings };
}

/**
 * Construit le plan.
 *
 * Chaque montant est décomposé en quatre termes dont la somme égale
 * exactement le montant affiché : convergence vers la cible, inclinaison
 * par le signal, pénalité de risque, ajustement d'arrondi.
 */
export function optimizePlan(
  portfolio: Asset[],
  analyses: Map<string, Analysis>,
  profile: Profile | null,
  dca: number,
  options: {
    excluded?: string[];
    manual?: Record<string, number>;
    realSectors?: Map<string, Partial<Record<string, number>>>;
    goal?: Goal | null;
  } = {},
): PlanOutcome {
  const { excluded = [], manual, realSectors, goal } = options;
  const budget = riskBudgetFromProfile(profile);
  const target = targetAllocation(profile, portfolio, analyses);
  const totalValue = portfolio.reduce((s, a) => s + Math.max(0, assetValue(a)), 0);
  const insight = goalInsight(totalValue, goal, budget);
  const risk = profile?.riskProfile ?? "equilibre";

  const empty: PlanOutcome = {
    lines: [],
    violations: [],
    budget,
    target,
    goal: insight,
    hhi: 0,
    warnings: [],
  };
  if (dca <= 0) return empty;

  const eligible = portfolio.filter(
    (a) => !excluded.includes(a.id) && Object.keys(regionSplit(a)).length > 0,
  );
  if (!eligible.length) return empty;

  // Répartition manuelle : elle prime, mais les contrôles s'appliquent.
  if (manual && Object.values(manual).some((v) => v > 0)) {
    const chosen = eligible.filter((a) => (manual[a.id] ?? 0) > 0);
    const sum = chosen.reduce((s, a) => s + (manual[a.id] ?? 0), 0);
    if (chosen.length && sum > 0) {
      const lines = chosen.map((a) => {
        const amount = Math.round((dca * (manual[a.id] ?? 0)) / sum);
        return {
          assetId: a.id,
          label: String(a.data["name"] ?? "Ligne"),
          amount,
          weight: Math.round((amount / dca) * 100),
          intent: intentFromSignal(analyses.get(a.id)?.composite?.score),
          gap: 0,
          breakdown: { convergence: amount, signal: 0, risk: 0, rounding: 0 },
        };
      });
      const impact = diversificationImpact(lines, portfolio, target, realSectors);
      return { ...empty, lines, hhi: impact.hhi, warnings: impact.warnings };
    }
  }

  // ── Écart à la cible, zone par zone, ramené à chaque ligne ──
  const current = aggregateExposures(portfolio, realSectors);
  const scored = eligible.map((a) => {
    const split = regionSplit(a);
    const an = analyses.get(a.id);
    // Écart pondéré : une ligne comble d'autant plus qu'elle est
    // exposée aux zones en retard.
    let gap = 0;
    for (const [zone, w] of Object.entries(split)) {
      const want = (target.byZone[zone] ?? 0) * target.equityShare;
      const now = current.byZone[zone] ?? 0;
      gap += (w ?? 0) * (want - now);
    }
    const intent = intentFromSignal(an?.composite?.score);
    return { asset: a, an, gap, intent, split };
  });

  // Une ligne en signal d'allègement ne reçoit rien, sauf si elle est
  // nettement sous-pondérée : on ne creuse pas un trou existant.
  const candidates = scored.filter((c) => c.intent !== "alleger" || c.gap > 0.05);
  if (!candidates.length) {
    return {
      ...empty,
      violations: [
        { code: "no_candidate", message: "Toutes vos lignes sont en signal d'allègement." },
      ],
    };
  }

  const violations: Violation[] = [];

  // ── Poids bruts : convergence, signal, pénalité de risque ──
  const raw = candidates.map((c) => {
    const convergence = Math.max(0, c.gap);
    const signalScore = c.an?.composite?.score ?? 0;
    // Une intention de maintien n'autorise pas de surpondération : le
    // signal ne peut alors que réduire, jamais augmenter.
    const signalBoost =
      c.intent === "renforcer" ? Math.max(0, signalScore) * 0.25 : Math.min(0, signalScore) * 0.25;
    const sigma = c.an?.volatility ?? target.equitySigma;
    // Au-delà du budget de risque, la ligne est pénalisée
    // proportionnellement à son excès de volatilité.
    const penalty = sigma > budget.sigmaTarget ? -((sigma - budget.sigmaTarget) / 100) * 0.5 : 0;
    const weight = Math.max(0.01, convergence + signalBoost + penalty);
    return { ...c, convergence, signalBoost, penalty, weight };
  });

  let weights = new Map(raw.map((r) => [r.asset.id, r.weight]));

  // ── Contraintes dures ──
  const applyCap = (
    predicate: (r: (typeof raw)[number]) => boolean,
    cap: number,
    code: string,
    message: string,
  ) => {
    const total = [...weights.values()].reduce((s, w) => s + w, 0);
    if (total <= 0) return;
    const share = raw.filter(predicate).reduce((s, r) => s + (weights.get(r.asset.id) ?? 0), 0) / total;
    if (share <= cap) return;
    violations.push({ code, message });
    const factor = cap / share;
    for (const r of raw.filter(predicate)) {
      weights.set(r.asset.id, (weights.get(r.asset.id) ?? 0) * factor);
    }
  };

  // C1 — plafond des supports les plus risqués selon le profil.
  const srriCap = SRRI_CAP[risk] ?? 0.15;
  applyCap(
    (r) => (r.an?.srri ?? 0) >= 6,
    srriCap,
    "srri_cap",
    srriCap === 0
      ? "Profil prudent : les supports les plus risqués sont écartés du versement."
      : `Profil ${risk} : les supports les plus risqués sont limités à ${Math.round(srriCap * 100)} % du versement.`,
  );

  // C2 — plafond par zone, et limite spécifique aux émergents.
  applyCap(
    (r) => (r.split["Émergents"] ?? 0) > 0.5,
    MAX_EM,
    "em_cap",
    `Émergents plafonnés à ${Math.round(MAX_EM * 100)} % du versement.`,
  );
  for (const zone of Object.keys(ZONE_BASE)) {
    applyCap(
      (r) => ((r.split as Record<string, number | undefined>)[zone] ?? 0) > 0.8,
      MAX_ZONE,
      `zone_cap:${zone}`,
      `${zone} plafonné à ${Math.round(MAX_ZONE * 100)} % du versement.`,
    );
  }

  // ── Montants, minimum par ligne, arrondis ──
  const totalWeight = [...weights.values()].reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return { ...empty, violations };

  let draft = raw
    .map((r) => ({ r, amount: (dca * (weights.get(r.asset.id) ?? 0)) / totalWeight }))
    .sort((a, b) => b.amount - a.amount);

  // Les miettes sont reportées sur la ligne la plus sous-pondérée.
  const kept = draft.filter((d) => d.amount >= MIN_TICKET);
  if (kept.length) {
    const dropped = draft.filter((d) => d.amount < MIN_TICKET);
    if (dropped.length) {
      const spill = dropped.reduce((s, d) => s + d.amount, 0);
      const receiver = [...kept].sort((a, b) => b.r.convergence - a.r.convergence)[0]!;
      receiver.amount += spill;
      violations.push({
        code: "min_ticket",
        message: `${dropped.length} ligne${dropped.length > 1 ? "s" : ""} sous ${MIN_TICKET} € reportée${dropped.length > 1 ? "s" : ""} : les frais d'ordre y dépasseraient un pour cent.`,
      });
    }
    draft = kept;
  }

  const lines: PlanLine[] = draft.map((d) => {
    const exact = d.amount;
    const amount = Math.round(exact);
    const scale = totalWeight > 0 ? dca / totalWeight : 0;
    // Décomposition : chaque terme est ramené à l'échelle des montants,
    // l'arrondi absorbant l'écart pour que la somme soit exacte.
    const convergence = Math.round(d.r.convergence * scale);
    const signal = Math.round(d.r.signalBoost * scale);
    const riskPart = Math.round(d.r.penalty * scale);
    return {
      assetId: d.r.asset.id,
      label: String(d.r.asset.data["name"] ?? "Ligne"),
      amount,
      weight: 0,
      intent: d.r.intent,
      gap: d.r.gap * 100,
      breakdown: {
        convergence,
        signal,
        risk: riskPart,
        rounding: amount - convergence - signal - riskPart,
      },
    };
  });

  // Le total doit retomber exactement sur le versement.
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (lines[0] && sum !== dca) {
    const delta = dca - sum;
    lines[0].amount += delta;
    lines[0].breakdown.rounding += delta;
  }
  for (const l of lines) l.weight = Math.round((l.amount / dca) * 100);

  const impact = diversificationImpact(lines, portfolio, target, realSectors);
  return {
    lines,
    violations,
    budget,
    target,
    goal: insight,
    hhi: impact.hhi,
    warnings: impact.warnings,
  };
}

/** Vérifie qu'aucune contrainte dure n'est violée après construction. */
export function applyHardConstraints(
  outcome: PlanOutcome,
  analyses: Map<string, Analysis>,
  profile: Profile | null,
): { plan: PlanLine[]; violations: Violation[] } {
  const risk = profile?.riskProfile ?? "equilibre";
  const cap = SRRI_CAP[risk] ?? 0.15;
  const total = outcome.lines.reduce((s, l) => s + l.amount, 0);
  const violations = [...outcome.violations];

  if (total > 0) {
    const risky = outcome.lines
      .filter((l) => (analyses.get(l.assetId)?.srri ?? 0) >= 6)
      .reduce((s, l) => s + l.amount, 0);
    if (risky / total > cap + 0.01) {
      violations.push({
        code: "srri_cap_residual",
        message: "La part des supports les plus risqués dépasse encore le plafond du profil.",
      });
    }
    for (const l of outcome.lines) {
      const score = analyses.get(l.assetId)?.composite?.score;
      if (l.intent === "renforcer" && intentFromSignal(score) !== "renforcer") {
        violations.push({
          code: "intent_mismatch",
          message: `${l.label} : le plan et la fiche ne portent pas la même intention.`,
        });
      }
    }
  }
  return { plan: outcome.lines, violations };
}
