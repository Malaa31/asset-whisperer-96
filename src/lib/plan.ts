import { assetValue } from "./calc";
import { goalCurrent } from "./goals";
import { diversificationFactor } from "./diversification";
import { suitabilityFactor } from "./riskMatrix";
import type { Analysis } from "./signals";
import { regionSplit, type Sector } from "./classify";
import type { Asset, AssetType, Goal, Profile, RiskProfile } from "./types";

/**
 * Moteur du plan de versement mensuel.
 *
 * Objectif : fixer une stratégie d'investissement et s'y tenir. Le
 * versement ne récompense pas les meilleures lignes du moment, il
 * rapproche le portefeuille de l'allocation visée en n'achetant que ce
 * qui manque — le rééquilibrage par les flux, qui évite de vendre et
 * donc la fiscalité et les frais.
 *
 * Cinq étapes, dans cet ordre :
 *   1. destinations éligibles — ce que l'utilisateur détient et qui peut
 *      recevoir un versement ;
 *   2. matelas de précaution — signalé, jamais alimenté par le plan ;
 *   3. répartition entre classes selon l'écart à la cible du profil ;
 *   4. répartition dans une classe selon la qualité de chaque ligne ;
 *   5. la saisie manuelle de l'utilisateur prime sur tout.
 */

// ─────────────────────────────────────────────────────────────────────
// Paramètres du modèle
// ─────────────────────────────────────────────────────────────────────

/** Mois de revenus attendus en réserve, selon le profil. */
const BUFFER_BY_PROFILE: Record<RiskProfile, number> = {
  prudent: 12,
  equilibre: 9,
  dynamique: 6,
  offensif: 4,
};

/** Allocation visée des sommes placées, hors matelas de précaution. */
const CLASS_TARGETS: Record<RiskProfile, Record<InvestClass, number>> = {
  prudent: { actions: 35, securise: 50, reels: 15 },
  equilibre: { actions: 60, securise: 25, reels: 15 },
  dynamique: { actions: 80, securise: 8, reels: 12 },
  offensif: { actions: 92, securise: 0, reels: 8 },
};

/**
 * Hypothèses de rendement annuel long terme par classe, utilisées pour
 * vérifier qu'un objectif est atteignable et, si besoin, incliner
 * l'allocation. Volontairement prudentes.
 */
const EXPECTED_RETURN: Record<InvestClass, number> = {
  actions: 0.075,
  securise: 0.025,
  reels: 0.045,
};

/**
 * Part maximale d'actions tolérée selon l'horizon restant de l'objectif.
 *
 * Un capital nécessaire dans deux ans ne se joue pas en bourse : la
 * probabilité de perte sur douze mois reste trop élevée pour une somme
 * dont la date est fixée. La contrainte se relâche progressivement et
 * disparaît au-delà de dix ans, où la dispersion des rendements actions
 * redevient acceptable.
 */
function horizonEquityCap(horizon: number): number {
  if (horizon <= 1) return 5;
  if (horizon <= 3) return 30;
  if (horizon <= 5) return 55;
  if (horizon <= 8) return 80;
  if (horizon <= 10) return 92;
  return 100;
}

/** Un versement inférieur ne vaut pas les frais d'ordre. */
const MIN_TICKET = 20;

/** Nombre maximal de lignes proposées dans un même plan. */
const MAX_LINES = 5;

/** Part maximale du versement sur une seule classe, hors cas unique. */
const MAX_CLASS_SHARE = 0.75;

// ─────────────────────────────────────────────────────────────────────
// Étape 1 — Destinations éligibles
// ─────────────────────────────────────────────────────────────────────

/** Classes recevant des versements. Le matelas n'en est pas une. */
export type InvestClass = "actions" | "securise" | "reels";

export const CLASS_LABELS: Record<InvestClass, string> = {
  actions: "Actions",
  securise: "Sécurisé",
  reels: "Actifs réels",
};

/** Supports d'immobilier papier, fractionnables donc abondables. */
const PAPER_REALESTATE = /\b(scpi|opci|sci\b|pierre[- ]papier|parts?)\b/i;

/** Or, argent et métaux, quel que soit le type de ligne saisi. */
const METALS = /\b(or\b|gold|argent m[ée]tal|silver|platine|palladium|m[ée]taux|lingot)\b/i;

/**
 * Classe d'une ligne pour le calcul d'allocation, ou null si elle relève
 * du matelas ou n'entre pas dans l'allocation des placements.
 */
export function classOf(a: Asset): InvestClass | null {
  const label = `${a.data["name"] ?? ""} ${a.data["type"] ?? ""} ${a.data["sector"] ?? ""}`;
  if (METALS.test(label)) return "reels";
  if (a.type === "pea" || a.type === "crypto") return "actions";
  if (a.type === "immo") return "reels";
  if (a.type === "av") {
    // Un contrat investi en unités de compte relève des actions, un
    // contrat en fonds euros de la poche sécurisée.
    const uc = Number(a.data["ucAmount"] ?? 0);
    const fonds = Number(a.data["fondsEurosAmount"] ?? 0);
    return uc > fonds ? "actions" : "securise";
  }
  return null; // livrets, comptes courants, crédits, divers
}

/**
 * Une ligne peut-elle recevoir un versement mensuel ?
 *
 * Un bien détenu en direct pèse dans l'allocation mais ne s'abonde pas :
 * on n'ajoute pas cinquante euros par mois à un appartement. Seuls les
 * supports fractionnables sont des destinations.
 */
export function isDestination(a: Asset): boolean {
  const cls = classOf(a);
  if (!cls) return false;
  if (assetValue(a) < 0) return false;
  if (a.type === "immo") {
    const label = `${a.data["name"] ?? ""} ${a.data["type"] ?? ""} ${a.data["sector"] ?? ""}`;
    return PAPER_REALESTATE.test(label) || METALS.test(label);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// Étape 2 — Matelas de précaution
// ─────────────────────────────────────────────────────────────────────

/**
 * Réserve mobilisable sans délai ni perte : livrets réglementés,
 * comptes courants, fonds euros d'assurance vie. Les liquidités d'un
 * PEA, PEE ou PER en sont exclues : un retrait anticipé y clôture le
 * plan ou suppose un cas de déblocage.
 */
export function isBuffer(a: Asset): boolean {
  const label = `${a.data["name"] ?? ""} ${a.data["envelope"] ?? ""}`.toLowerCase();
  if (/\b(pea|pee|per)\b/.test(label)) return false;
  if (a.type === "livret" || a.type === "cash") return true;
  if (a.type === "av") return Number(a.data["fondsEurosAmount"] ?? 0) > 0;
  return false;
}

export interface BufferStatus {
  amount: number;
  months?: number;
  threshold: number;
  sufficient: boolean;
}

export function bufferStatus(assets: Asset[], profile: Profile | null): BufferStatus {
  const risk = profile?.riskProfile ?? "equilibre";
  const threshold = BUFFER_BY_PROFILE[risk] ?? 9;
  const amount = assets.filter(isBuffer).reduce((s, a) => s + assetValue(a), 0);
  const income = profile?.incomeMonthly ?? 0;
  if (income <= 0) return { amount, threshold, sufficient: false };
  const months = amount / income;
  return { amount, months, threshold, sufficient: months >= threshold };
}


// ─────────────────────────────────────────────────────────────────────
// Objectif : faisabilité et inclinaison de l'allocation
// ─────────────────────────────────────────────────────────────────────

/**
 * Rendement annuel qu'il faudrait obtenir pour atteindre l'objectif à
 * l'échéance, en versant `dca` chaque mois. Résolu par dichotomie : la
 * valeur future est strictement croissante avec le taux, une recherche
 * binaire converge donc sans risque d'osciller.
 */
export function requiredReturn(current: number, dca: number, goal: Goal): number | undefined {
  const years = Math.max(0.5, goal.horizon);
  const target = goal.amount;
  if (target <= 0) return undefined;
  const fv = (r: number): number => {
    const m = r / 12;
    const n = years * 12;
    const growth = Math.pow(1 + m, n);
    const annuity = Math.abs(m) < 1e-9 ? n : (growth - 1) / m;
    return current * growth + dca * annuity;
  };
  if (fv(-0.05) >= target) return -0.05;
  if (fv(0.5) < target) return undefined; // hors d'atteinte à ce versement
  let lo = -0.05;
  let hi = 0.5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fv(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Classe d'investissement visée par un objectif d'enveloppe. */
function scopeClass(scope: AssetType | undefined): InvestClass | null {
  switch (scope) {
    case "pea":
    case "crypto":
      return "actions";
    case "immo":
      return "reels";
    case "av":
    case "livret":
    case "cash":
      return "securise";
    default:
      return null;
  }
}

export interface TargetContext {
  targets: Record<InvestClass, number>;
  reasons: string[];
  required?: number;
  expected: number;
}

/**
 * Allocation cible effective : celle du profil de risque, corrigée par
 * l'horizon de l'objectif actif puis par sa faisabilité.
 *
 * C'est le point où le plan cesse d'être générique. Deux utilisateurs
 * au même profil « dynamique » n'obtiennent pas la même répartition si
 * l'un vise un apport dans trois ans et l'autre une retraite dans vingt.
 */
export function effectiveTargets(
  risk: RiskProfile,
  goal: Goal | null | undefined,
  currentValue: number,
  dca: number,
): TargetContext {
  const base = CLASS_TARGETS[risk] ?? CLASS_TARGETS.equilibre;
  const t: Record<InvestClass, number> = { ...base };
  const reasons: string[] = [];

  if (goal) {
    // 1. Contrainte d'horizon : on ne prend pas de risque pour une somme
    //    dont la date est proche.
    const cap = horizonEquityCap(goal.horizon);
    if (t.actions > cap) {
      const moved = t.actions - cap;
      t.actions = cap;
      t.securise += moved * 0.7;
      t.reels += moved * 0.3;
      reasons.push(
        `Horizon de ${goal.horizon} an${goal.horizon > 1 ? "s" : ""} : part actions plafonnée à ${Math.round(cap)} %.`,
      );
    }

    // 2. Objectif d'enveloppe : la poche correspondante est renforcée,
    //    sans jamais dépasser le plafond d'horizon.
    const sc = scopeClass(goal.scope);
    if (goal.kind === "enveloppe" && sc) {
      const boost = Math.min(12, 100 - t[sc]);
      if (boost > 0 && !(sc === "actions" && t.actions >= cap)) {
        t[sc] += boost;
        const others = (Object.keys(t) as InvestClass[]).filter((c) => c !== sc);
        const sum = others.reduce((s2, c) => s2 + t[c], 0);
        for (const c of others) t[c] -= sum > 0 ? (boost * t[c]) / sum : 0;
        reasons.push(`Objectif ciblé sur « ${goal.label} » : cette poche est renforcée.`);
      }
    }
  }

  const total = (Object.keys(t) as InvestClass[]).reduce((s2, c) => s2 + Math.max(0, t[c]), 0);
  for (const c of Object.keys(t) as InvestClass[]) {
    t[c] = total > 0 ? (Math.max(0, t[c]) / total) * 100 : 0;
  }

  const expected = (Object.keys(t) as InvestClass[]).reduce(
    (s2, c) => s2 + (t[c] / 100) * EXPECTED_RETURN[c],
    0,
  );

  // 3. Faisabilité : le rendement nécessaire se compare au rendement
  //    espéré de la cible.
  let required: number | undefined;
  if (goal) {
    required = requiredReturn(currentValue, dca, goal);
    if (required === undefined) {
      reasons.push(
        "Objectif hors d'atteinte à ce versement : augmenter le montant mensuel ou allonger l'horizon.",
      );
    } else if (required > expected + 0.015 && horizonEquityCap(goal.horizon) > t.actions) {
      const room = Math.min(10, horizonEquityCap(goal.horizon) - t.actions);
      t.actions += room;
      t.securise = Math.max(0, t.securise - room);
      reasons.push(
        `L'objectif demande ${(required * 100).toFixed(1)} % par an contre ${(expected * 100).toFixed(1)} % attendus : allocation légèrement plus offensive.`,
      );
    } else if (required < expected - 0.02) {
      const room = Math.min(10, t.actions);
      t.actions -= room;
      t.securise += room;
      reasons.push(
        `${(required * 100).toFixed(1)} % par an suffisent : inutile de prendre plus de risque que nécessaire.`,
      );
    }
  }

  return { targets: t, reasons, ...(required !== undefined ? { required } : {}), expected };
}

// ─────────────────────────────────────────────────────────────────────
// Résultat
// ─────────────────────────────────────────────────────────────────────

export interface PlanLine {
  assetId: string;
  label: string;
  cls: InvestClass;
  amount: number;
  weight: number;
  signal?: Analysis["signal"];
  /** « matelas » pour la part dirigée vers la réserve de précaution. */
  purpose?: "matelas";
}

export interface ClassView {
  cls: InvestClass;
  current: number;
  target: number;
  share: number;
}

export interface PlanResult {
  lines: PlanLine[];
  classes: ClassView[];
  buffer: BufferStatus;
  manual: boolean;
  note?: string;
  /** Pourquoi cette répartition : horizon, objectif, faisabilité. */
  rationale: string[];
  /** Rendement annuel nécessaire pour tenir l'objectif, si calculable. */
  required?: number;
  /** Rendement annuel espéré de l'allocation cible. */
  expected?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Moteur
// ─────────────────────────────────────────────────────────────────────

export function buildPlan(
  assets: Asset[],
  analyses: Map<string, Analysis>,
  profile: Profile | null,
  dca: number,
  excluded: string[] = [],
  manual?: Record<string, number>,
  /** Compositions sectorielles publiées, par ticker. */
  realSectors?: Map<string, Partial<Record<Sector, number>>>,
  /** Objectif actif : horizon, montant, périmètre. */
  goal?: Goal | null,
): PlanResult {
  const risk = profile?.riskProfile ?? "equilibre";
  const buffer = bufferStatus(assets, profile);
  const empty = { lines: [], classes: [], buffer, manual: false, rationale: [] as string[] };

  if (dca <= 0) return { ...empty, note: "Définissez un versement mensuel dans votre objectif." };

  const destinations = assets.filter((a) => isDestination(a) && !excluded.includes(a.id));
  if (!destinations.length) {
    return { ...empty, note: "Aucun support de votre patrimoine ne peut recevoir de versement." };
  }

  // ── Étape 5 (prioritaire) : la saisie manuelle prime ──
  if (manual && Object.values(manual).some((v) => v > 0)) {
    const chosen = destinations.filter((a) => (manual[a.id] ?? 0) > 0);
    const sum = chosen.reduce((s, a) => s + (manual[a.id] ?? 0), 0);
    if (chosen.length && sum > 0) {
      return {
        lines: chosen.map((a) => toLine(a, (dca * (manual[a.id] ?? 0)) / sum, analyses)),
        classes: [],
        buffer,
        manual: true,
        rationale: ["Répartition saisie à la main : le modèle n'intervient pas."],
      };
    }
  }

  // ── Étape 3 : répartition entre classes ──
  // L'allocation actuelle se lit en net de dettes et porte sur tout le
  // patrimoine placé, y compris ce qui ne peut pas recevoir de versement :
  // un bien immobilier compte dans l'exposition même s'il ne s'abonde pas.
  const debt = assets
    .filter((a) => a.type === "credit")
    .reduce((s, a) => s + Math.abs(assetValue(a)), 0);

  const grossOf = (c: InvestClass): number =>
    assets
      .filter((a) => classOf(a) === c && assetValue(a) > 0)
      .reduce((s, a) => s + assetValue(a), 0);

  // Les crédits s'imputent sur les actifs réels, qu'ils financent
  // presque toujours ; l'excédent éventuel sur le reste.
  const reelsNet = Math.max(0, grossOf("reels") - debt);
  const restDebt = Math.max(0, debt - grossOf("reels"));
  const netOf = (c: InvestClass): number => {
    if (c === "reels") return reelsNet;
    const gross = grossOf(c);
    const other = grossOf("actions") + grossOf("securise");
    return Math.max(0, gross - (other > 0 ? (restDebt * gross) / other : 0));
  };

  const placed = (["actions", "securise", "reels"] as InvestClass[]).reduce(
    (s, c) => s + netOf(c),
    0,
  );

  // Classes où l'utilisateur possède un support abondable.
  const open = (["actions", "securise", "reels"] as InvestClass[]).filter((c) =>
    destinations.some((a) => classOf(a) === c),
  );

  // Cible effective : profil de risque corrigé par l'horizon, le
  // périmètre et la faisabilité de l'objectif actif.
  const ctx = effectiveTargets(risk, goal, goal ? goalCurrent(assets, goal) : placed, dca);
  const rationale = [...ctx.reasons];
  const base = ctx.targets;

  // ── Matelas d'abord ──
  // Tant que la réserve n'atteint pas le nombre de mois attendus pour le
  // profil, une part du versement y va. Investir avant d'avoir de quoi
  // encaisser un imprévu revient à s'obliger à vendre au mauvais moment.
  const bufferTarget = assets
    .filter(isBuffer)
    .sort((a, b) => assetValue(b) - assetValue(a))[0];
  let bufferAmount = 0;
  if (bufferTarget && !buffer.sufficient) {
    const income = profile?.incomeMonthly ?? 0;
    const missing =
      income > 0
        ? Math.max(0, buffer.threshold * income - buffer.amount)
        : Math.max(0, 3000 - buffer.amount);
    const deficit =
      income > 0 && buffer.months !== undefined
        ? Math.min(1, Math.max(0, (buffer.threshold - buffer.months) / buffer.threshold))
        : 0.5;
    const share = Math.min(0.6, 0.15 + 0.55 * deficit);
    bufferAmount = Math.round(Math.min(dca * share, missing));
    if (bufferAmount < MIN_TICKET) bufferAmount = 0;
    if (bufferAmount > 0) {
      rationale.push(
        income > 0
          ? `Matelas à ${(buffer.months ?? 0).toFixed(1)} mois pour ${buffer.threshold} attendus : une part du versement le complète d'abord.`
          : "Matelas de précaution incomplet : une part du versement le complète d'abord.",
      );
    }
  }
  const investable = Math.max(0, dca - bufferAmount);
  // Les cibles se renormalisent sur les classes ouvertes : l'app ne
  // suggère jamais d'ouvrir un support absent du patrimoine.
  const openSum = open.reduce((s, c) => s + base[c], 0);
  const target = (c: InvestClass): number =>
    openSum > 0 ? (base[c] / openSum) * 100 : 100 / Math.max(1, open.length);
  const current = (c: InvestClass): number => (placed > 0 ? (netOf(c) / placed) * 100 : 0);

  // Le matelas excédentaire remplit déjà la fonction défensive : sans
  // cette lecture, l'app ferait verser sur un fonds euros alors que les
  // livrets débordent.
  const bufferSurplus =
    buffer.months !== undefined && buffer.months > buffer.threshold && placed > 0
      ? ((buffer.months - buffer.threshold) * (profile?.incomeMonthly ?? 0) * 100) / placed
      : 0;

  const gaps = open.map((c) => {
    const need = c === "securise" ? target(c) - current(c) - bufferSurplus : target(c) - current(c);
    return { cls: c, gap: Math.max(0, need) };
  });

  const behind = gaps.filter((g) => g.gap > 0);
  const pool = behind.length ? behind : open.map((c) => ({ cls: c, gap: target(c) }));
  const gapSum = pool.reduce((s, g) => s + g.gap, 0);

  const shares = new Map<InvestClass, number>();
  for (const g of pool) shares.set(g.cls, gapSum > 0 ? g.gap / gapSum : 1 / pool.length);

  // Une seule classe en retard ne doit pas rafler tout le versement : le
  // reste va aux autres classes ouvertes, au prorata de leur cible. On
  // continue ainsi d'alimenter le cœur du portefeuille pendant qu'un
  // écart se comble.
  if (shares.size === 1 && open.length > 1) {
    const [only] = [...shares.keys()];
    if (only) {
      // La part accordée dépend de l'ampleur de l'écart : un retard de
      // deux points ne justifie pas de détourner les trois quarts du
      // versement, un retard de trente points si.
      const gap = pool[0]?.gap ?? 0;
      const share = Math.min(MAX_CLASS_SHARE, 0.4 + gap / 60);
      shares.set(only, share);
      const rest = open.filter((c) => c !== only);
      const restSum = rest.reduce((s2, c) => s2 + target(c), 0);
      for (const c of rest) {
        shares.set(c, (1 - share) * (restSum > 0 ? target(c) / restSum : 1 / rest.length));
      }
    }
  }

  // Aucune classe n'absorbe la totalité quand plusieurs sont ouvertes :
  // combler un écart en plusieurs mois vaut mieux que tout concentrer.
  if (shares.size > 1) {
    let excess = 0;
    for (const [c, sh] of shares) {
      if (sh > MAX_CLASS_SHARE) {
        excess += sh - MAX_CLASS_SHARE;
        shares.set(c, MAX_CLASS_SHARE);
      }
    }
    if (excess > 0) {
      const room = [...shares.entries()].filter(([, sh]) => sh < MAX_CLASS_SHARE);
      const roomSum = room.reduce((s, [, sh]) => s + (MAX_CLASS_SHARE - sh), 0);
      for (const [c, sh] of room) {
        shares.set(c, sh + (roomSum > 0 ? (excess * (MAX_CLASS_SHARE - sh)) / roomSum : 0));
      }
    }
  }

  // ── Étape 4 : répartition dans chaque classe ──
  const lines: PlanLine[] = [];
  for (const [cls, share] of shares) {
    const budget = investable * share;
    if (budget < MIN_TICKET) continue;

    const pool2 = destinations.filter((a) => {
      if (classOf(a) !== cls) return false;
      // On ne renforce pas une ligne qu'on envisage de réduire.
      return analyses.get(a.id)?.signal !== "alleger";
    });
    if (!pool2.length) continue;

    const weighted = pool2
      .map((a) => {
        const an = analyses.get(a.id);
        // Sans historique exploitable — un fonds euros n'en a pas —, la
        // ligne reçoit une qualité neutre plutôt que d'être écartée.
        const quality = an?.score ?? 50;
        // Ancrage du cœur de portefeuille : un support couvrant plusieurs
        // zones prime sur un fonds de niche. Sans ce poids, un fonds
        // émergent bien noté passait devant un ETF Monde, ce qui inverse
        // la logique d'un portefeuille cœur-satellite.
        const breadth = Object.values(regionSplit(a)).filter((x) => (x ?? 0) > 0.02).length;
        const core = breadth >= 4 ? 1.5 : breadth === 3 ? 1.25 : 1;
        // Objectif d'enveloppe : à qualité comparable, le support qui
        // porte l'objectif passe devant.
        const onGoal =
          goal?.kind === "enveloppe" && goal.scope && a.type === goal.scope ? 1.35 : 1;
        const w = clamp(
          quality *
            core *
            onGoal *
            suitabilityFactor(a, risk) *
            diversificationFactor(a, assets, realSectors),
          10,
          200,
        );
        return { asset: a, w };
      })
      .sort((x, y) => y.w - x.w)
      .slice(0, MAX_LINES);

    const wSum = weighted.reduce((s, x) => s + x.w, 0);
    for (const x of weighted) {
      const amount = (budget * x.w) / wSum;
      if (amount < MIN_TICKET && weighted.length > 1) continue;
      lines.push(toLine(x.asset, amount, analyses));
    }
  }

  if (!lines.length && bufferAmount <= 0) {
    return { ...empty, note: "Le versement est trop faible pour être réparti sur vos supports." };
  }

  // Arrondis : le total placé doit retomber exactement sur la part
  // investissable, matelas déduit.
  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (total > 0) {
    for (const l of lines) l.amount = Math.round((l.amount * investable) / total);
    const rounded = lines.reduce((s, l) => s + l.amount, 0);
    if (lines[0] && rounded !== investable) lines[0].amount += investable - rounded;
  }
  lines.sort((a, b) => b.amount - a.amount);

  if (bufferTarget && bufferAmount > 0) {
    lines.unshift({
      assetId: bufferTarget.id,
      label: String(bufferTarget.data["name"] ?? "Réserve de précaution"),
      cls: "securise",
      amount: bufferAmount,
      weight: 0,
      purpose: "matelas",
    });
  }
  for (const l of lines) l.weight = Math.round((l.amount / dca) * 100);

  const classes: ClassView[] = (["actions", "securise", "reels"] as InvestClass[])
    .filter((c) => netOf(c) > 0 || open.includes(c))
    .map((c) => ({
      cls: c,
      current: current(c),
      target: target(c),
      share:
        (lines
          .filter((l) => l.cls === c && l.purpose !== "matelas")
          .reduce((s, l) => s + l.amount, 0) /
          Math.max(1, investable)) *
        100,
    }));

  return {
    lines,
    classes,
    buffer,
    manual: false,
    rationale,
    ...(ctx.required !== undefined ? { required: ctx.required } : {}),
    expected: ctx.expected,
  };
}

function toLine(a: Asset, amount: number, analyses: Map<string, Analysis>): PlanLine {
  const an = analyses.get(a.id);
  return {
    assetId: a.id,
    label: String(a.data["name"] ?? "Ligne"),
    cls: classOf(a) ?? "actions",
    amount: Math.round(amount),
    weight: 0,
    ...(an ? { signal: an.signal } : {}),
  };
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
