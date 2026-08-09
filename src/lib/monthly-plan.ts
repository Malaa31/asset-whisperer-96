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
  /** Nom du support. */
  label: string;
  /** Libellé d'action, croisant signal et écart à la cible. */
  action: PlanLabel;
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
  /** État de la poche défensive. */
  defensive?: DefensiveStatus;
  /** Paires de supports se recouvrant nettement. */
  overlaps?: Array<{ a: string; b: string; rate: number }>;
  /** Concentration géographique des expositions. */
  zoneConcentration?: number;
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
// ─────────────────────────────────────────────────────────────────────
// Poches de risque, chevauchement, libellés
// ─────────────────────────────────────────────────────────────────────

export type Pocket = "defensive" | "balanced" | "risky";

/**
 * Poche d'un actif, déduite de sa volatilité et non de son nom ni de son
 * enveloppe. Un fonds euros et un livret réglementaire relèvent de la
 * même poche, quelle que soit l'étiquette commerciale du support.
 */
export function classifyPocket(asset: Asset, analyses?: Map<string, Analysis>): Pocket {
  const measured = analyses?.get(asset.id)?.volatility;
  if (typeof measured === "number" && measured > 0) {
    if (measured < 3) return "defensive";
    return measured < 8 ? "balanced" : "risky";
  }
  // Sans mesure : les supports à capital garanti sont défensifs par
  // construction, les lignes cotées sont risquées.
  if (asset.type === "livret" || asset.type === "cash") return "defensive";
  if (asset.type === "av") {
    const uc = Number(asset.data["ucAmount"] ?? 0);
    const fonds = Number(asset.data["fondsEurosAmount"] ?? 0);
    return uc > fonds ? "risky" : "defensive";
  }
  if (asset.type === "pea" || asset.type === "crypto") return "risky";
  return "balanced";
}

/** Un actif entre-t-il dans le patrimoine financier liquide ? */
export function isFinancial(asset: Asset): boolean {
  return asset.type !== "immo" && asset.type !== "credit" && asset.type !== "autre";
}

export interface DefensiveStatus {
  current: number;
  target: number;
  /** Montant manquant, nul si la poche est déjà couverte. */
  gap: number;
  covered: boolean;
  message?: string;
}

/**
 * État de la poche défensive.
 *
 * Le patrimoine immobilier et les crédits en sont exclus : ils ne se
 * réallouent pas d'un mois sur l'autre et fausseraient la cible.
 */
export function defensiveGap(
  portfolio: Asset[],
  profile: Profile | null,
  analyses: Map<string, Analysis>,
): DefensiveStatus {
  const financial = portfolio.filter(isFinancial);
  const total = financial.reduce((s, a) => s + Math.max(0, assetValue(a)), 0);
  const current = financial
    .filter((a) => classifyPocket(a, analyses) === "defensive")
    .reduce((s, a) => s + Math.max(0, assetValue(a)), 0);

  const target = targetAllocation(profile, portfolio, analyses);
  const wanted = total * (1 - target.equityShare);
  const gap = Math.max(0, wanted - current);
  const covered = current >= wanted;
  const share = total > 0 ? current / total : 0;

  return {
    current,
    target: wanted,
    gap,
    covered,
    ...(covered
      ? {
          message: `Votre poche sécurisée représente ${Math.round(share * 100)} % de votre patrimoine financier, au-dessus des ${Math.round((1 - target.equityShare) * 100)} % visés pour ce profil (${Math.round(current).toLocaleString("fr-FR")} € pour ${Math.round(wanted).toLocaleString("fr-FR")} € attendus). Ce versement va donc intégralement en actions.`,
        }
      : {}),
  };
}

/** Prélèvements sociaux sur les produits de placement. */
const SOCIAL_TAX = 0.172;

/**
 * Rendement net annuel d'un support défensif, en pourcentage.
 * Le taux d'un livret réglementé est déjà net ; celui d'un fonds euros
 * s'entend brut de frais et avant prélèvements sociaux.
 */
export function netYield(asset: Asset): number | undefined {
  const rate = Number(asset.data["taux"] ?? 0);
  if (asset.type === "livret") return rate > 0 ? rate : undefined;
  if (asset.type === "av") {
    const gross = Number(asset.data["fondsEurosRendement"] ?? 0);
    if (gross <= 0) return undefined;
    const fees = Number(asset.data["fraisGestion"] ?? 0.6);
    return (gross - fees) * (1 - SOCIAL_TAX);
  }
  return undefined;
}

/** Exposition réelle, en parts, sur les seules lignes actions. */
export function realExposure(
  portfolio: Asset[],
  realSectors?: Map<string, Partial<Record<string, number>>>,
): Exposures {
  return aggregateExposures(portfolio, realSectors);
}

/**
 * Taux de recouvrement entre deux supports : somme des parts communes
 * zone par zone. Un ETF monde et un ETF américain se recouvrent à
 * hauteur de la part américaine du premier.
 */
export function overlap(a: Asset, b: Asset): number {
  const sa = regionSplit(a);
  const sb = regionSplit(b);
  const zones = new Set([...Object.keys(sa), ...Object.keys(sb)]);
  let common = 0;
  for (const z of zones) {
    const wa = (sa as Record<string, number | undefined>)[z] ?? 0;
    const wb = (sb as Record<string, number | undefined>)[z] ?? 0;
    common += Math.min(wa, wb);
  }
  return common;
}

export function overlapMatrix(assets: Asset[]): number[][] {
  return assets.map((a) => assets.map((b) => (a.id === b.id ? 1 : overlap(a, b))));
}

/**
 * Concentration d'une répartition, entre 0 et 1.
 * Mesurée sur les expositions et non sur le nombre de lignes : quatre
 * supports pointant vers les mêmes marchés ne diversifient rien.
 */
export function concentrationIndex(shares: Record<string, number>): number {
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  return Object.values(shares).reduce((s, v) => s + (v / total) ** 2, 0);
}

export type PlanLabel = "renforcer" | "rattraper" | "maintenir" | "reduire";

export const LABEL_TEXT: Record<PlanLabel, string> = {
  renforcer: "Renforcer",
  rattraper: "Rattraper",
  maintenir: "Maintenir",
  reduire: "Réduire",
};

/**
 * Libellé d'une ligne du plan, croisant le signal de marché et l'écart
 * à l'allocation cible.
 *
 * Un signal favorable ne suffit pas à justifier un renforcement : encore
 * faut-il que la ligne soit réellement sous-pondérée. À l'inverse, un
 * écart important se comble même sans signal, ce que dit « rattraper ».
 * Le score employé est celui de la fiche, jamais recalculé.
 */
export function planLabel(signalScore: number | undefined, gapPoints: number): PlanLabel {
  const s = signalScore ?? 0;
  const under = gapPoints > 3;
  const over = gapPoints < -3;
  if (s > 0.35) return under ? "renforcer" : "maintenir";
  if (s >= -0.15) return under ? "rattraper" : over ? "reduire" : "maintenir";
  return under ? "maintenir" : "reduire";
}

export function optimizePlan(
  portfolio: Asset[],
  analyses: Map<string, Analysis>,
  profile: Profile | null,
  dca: number,
  options: {
    excluded?: string[];
    /** Lignes ajoutées à la main, exemptées du filtre de redondance. */
    included?: string[];
    manual?: Record<string, number>;
    realSectors?: Map<string, Partial<Record<string, number>>>;
    goal?: Goal | null;
  } = {},
): PlanOutcome {
  const { excluded = [], included = [], manual, realSectors, goal } = options;
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

  // Un support défensif n'est alimenté que si la poche l'est
  // insuffisamment : verser sur un fonds euros quand les livrets
  // débordent déjà revient à immobiliser sans raison.
  const defensive = defensiveGap(portfolio, profile, analyses);
  const eligible = portfolio.filter((a) => {
    if (excluded.includes(a.id)) return false;
    if (!Object.keys(regionSplit(a)).length) return false;
    if (included.includes(a.id)) return true;
    if (classifyPocket(a, analyses) === "defensive" && defensive.covered) return false;
    return true;
  });
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
          action: "maintenir" as PlanLabel,
          gap: 0,
          breakdown: { convergence: amount, signal: 0, risk: 0, rounding: 0 },
        };
      });
      const impact = diversificationImpact(lines, portfolio, target, realSectors);
      return { ...empty, lines, hhi: impact.hhi, warnings: impact.warnings };
    }
  }

  // ── Écart à la cible, zone par zone, ramené à chaque ligne ──
  const tiltPref = profile?.tiltGeographique ?? "neutre";
  const current = aggregateExposures(portfolio, realSectors);
  const scored = eligible.map((a) => {
    const split = regionSplit(a);
    const an = analyses.get(a.id);
    // Écart pondéré : une ligne comble d'autant plus qu'elle est
    // exposée aux zones en retard.
    let gap = 0;
    for (const [zone, w] of Object.entries(split)) {
      // Une inclinaison assumée relève la cible de la zone choisie d'un
      // quart, le reste étant renormalisé.
      const tiltZone =
        tiltPref === "US" ? "États-Unis" : tiltPref === "Europe" ? "Europe" : tiltPref === "EM" ? "Émergents" : null;
      const boost = tiltZone && zone === tiltZone ? 1.25 : 1;
      const want = (target.byZone[zone] ?? 0) * boost * target.equityShare;
      const now = current.byZone[zone] ?? 0;
      gap += (w ?? 0) * (want - now);
    }
    // L'écart est exprimé en points de pourcentage du portefeuille.
    const label = planLabel(an?.composite?.score, gap * 100);
    const intent: PlanIntent =
      label === "renforcer" ? "renforcer" : label === "reduire" ? "alleger" : "maintenir";
    return { asset: a, an, gap, intent, label, split };
  });

  // Une ligne en signal d'allègement ne reçoit rien, sauf si elle est
  // nettement sous-pondérée : on ne creuse pas un trou existant.
  // Seul un signal franchement négatif écarte une ligne. Un libellé
  // « réduire » né d'un simple excès de pondération la déprioriser suffit :
  // l'exclure viderait le plan d'un portefeuille pourtant investissable.
  const violationsPre: Violation[] = [];
  let candidates = scored.filter(
    (c) => included.includes(c.asset.id) || (c.an?.composite?.score ?? 0) >= -0.15 || c.gap > 0.05,
  );

  // En l'absence d'inclinaison assumée, une seule ligne est financée par
  // zone : alimenter un fonds monde et un fonds américain revient à
  // surpondérer les États-Unis sans le décider. Entre deux supports qui
  // se recouvrent largement, on garde le plus large — celui qui couvre
  // le plus de zones —, et à couverture égale le moins chargé en frais.
  const tilt = profile?.tiltGeographique ?? "neutre";
  if (tilt === "neutre" && candidates.length > 1) {
    const dropped: string[] = [];
    const kept: typeof candidates = [];
    for (const c of [...candidates].sort(
      (a, b) => Object.keys(b.split).length - Object.keys(a.split).length,
    )) {
      // Une ligne ajoutée à la main est toujours conservée : le moteur
      // recalcule alors la répartition autour d'elle plutôt que de la
      // refuser. L'utilisateur assume l'inclinaison, le modèle en tire
      // les conséquences sur les autres lignes.
      const forced = included.includes(c.asset.id);
      const twin = forced ? undefined : kept.find((k) => overlap(k.asset, c.asset) > 0.6);
      if (twin) {
        dropped.push(String(c.asset.data["name"] ?? ""));
        continue;
      }
      kept.push(c);
    }
    if (dropped.length) {
      candidates = kept;
      violationsPre.push({
        code: "single_vehicle",
        message: `${dropped.join(", ")} : déjà couvert par un support plus large. Sans inclinaison assumée, une seule ligne est financée par zone.`,
      });
    }
  }
  if (!candidates.length) {
    return {
      ...empty,
      violations: [
        { code: "no_candidate", message: "Toutes vos lignes sont en signal d'allègement." },
      ],
    };
  }

  const violations: Violation[] = [...violationsPre];

  // Quand aucune zone n'est en retard — un portefeuille déjà conforme à
  // sa cible —, le versement suit simplement l'allocation visée plutôt
  // que de se répartir à parts égales, ce qui diluerait le cœur du
  // portefeuille au profit des satellites.
  const anyGap = candidates.some((c) => c.gap > 0.005);
  const tiltZone =
    tiltPref === "US"
      ? "États-Unis"
      : tiltPref === "Europe"
        ? "Europe"
        : tiltPref === "EM"
          ? "Émergents"
          : null;

  const targetWeightOf = (
    split: Record<string, number | undefined>,
    isSatellite: boolean,
  ): number => {
    // Un satellite mono-zone d'une zone déjà couverte par un support
    // large ne reçoit que le supplément voulu par l'inclinaison, jamais
    // la cible entière : sinon il prendrait la place du cœur.
    if (isSatellite && tiltZone) return (target.byZone[tiltZone] ?? 0) * 0.25;
    let w = 0;
    for (const [zone, part] of Object.entries(split)) {
      w += (part ?? 0) * (target.byZone[zone] ?? 0);
    }
    return w;
  };

  // ── Poids bruts : convergence, signal, pénalité de risque ──
  const raw = candidates.map((c) => {
    const split = c.split as Record<string, number | undefined>;
    // Satellite : concentré sur la zone inclinée, alors qu'un support
    // plus large la couvre déjà.
    const isSatellite =
      tiltZone !== null &&
      (split[tiltZone] ?? 0) > 0.8 &&
      candidates.some((o) => o !== c && Object.keys(o.split).length >= 3);
    const convergence = anyGap ? Math.max(0, c.gap) : targetWeightOf(split, isSatellite);
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
    // Sans écart à combler, le versement entretient la cible : parler de
    // réduction serait trompeur puisqu'on continue d'acheter.
    const action: PlanLabel = anyGap ? d.r.label : d.r.label === "reduire" ? "maintenir" : d.r.label;
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
      action,
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

  // Chevauchements entre supports réellement alimentés : deux ETF qui se
  // recouvrent largement ne diversifient pas, ils inclinent.
  const funded = lines.map((l) => portfolio.find((a) => a.id === l.assetId)).filter(Boolean) as Asset[];
  const overlaps: Array<{ a: string; b: string; rate: number }> = [];
  for (let i = 0; i < funded.length; i++) {
    for (let j = i + 1; j < funded.length; j++) {
      const rate = overlap(funded[i]!, funded[j]!);
      if (rate > 0.3) {
        overlaps.push({
          a: String(funded[i]!.data["name"] ?? ""),
          b: String(funded[j]!.data["name"] ?? ""),
          rate,
        });
      }
    }
  }

  const exposure = realExposure(portfolio, realSectors);
  const zoneConcentration = concentrationIndex(exposure.byZone);

  const impact = diversificationImpact(lines, portfolio, target, realSectors);
  const extraWarnings = [...impact.warnings];
  if (defensive.message) extraWarnings.unshift(defensive.message);
  for (const o of overlaps) {
    extraWarnings.push(
      `${o.a} et ${o.b} se recouvrent à ${Math.round(o.rate * 100)} % : les alimenter tous deux surpondère une zone plutôt que de diversifier.`,
    );
  }
  if (zoneConcentration > 0.35) {
    const top = Object.entries(exposure.byZone).sort((a, b) => b[1] - a[1])[0];
    extraWarnings.push(
      `Concentration géographique élevée (${zoneConcentration.toFixed(2)})${top ? `, portée par ${top[0]}` : ""}.`,
    );
  }

  return {
    lines,
    defensive,
    overlaps,
    zoneConcentration,
    violations,
    budget,
    target,
    goal: insight,
    hhi: impact.hhi,
    warnings: extraWarnings,
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
