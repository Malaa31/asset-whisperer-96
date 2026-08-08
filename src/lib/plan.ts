import { assetValue } from "./calc";
import { diversificationFactor } from "./diversification";
import { suitabilityFactor } from "./riskMatrix";
import type { Analysis } from "./signals";
import type { Asset, Profile, RiskProfile } from "./types";

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
// Résultat
// ─────────────────────────────────────────────────────────────────────

export interface PlanLine {
  assetId: string;
  label: string;
  cls: InvestClass;
  amount: number;
  weight: number;
  signal?: Analysis["signal"];
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
): PlanResult {
  const risk = profile?.riskProfile ?? "equilibre";
  const buffer = bufferStatus(assets, profile);
  const empty = { lines: [], classes: [], buffer, manual: false };

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

  const base = CLASS_TARGETS[risk] ?? CLASS_TARGETS.equilibre;
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
      shares.set(only, MAX_CLASS_SHARE);
      const rest = open.filter((c) => c !== only);
      const restSum = rest.reduce((s2, c) => s2 + target(c), 0);
      for (const c of rest) {
        shares.set(
          c,
          (1 - MAX_CLASS_SHARE) * (restSum > 0 ? target(c) / restSum : 1 / rest.length),
        );
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
    const budget = dca * share;
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
        const w = clamp(
          quality * suitabilityFactor(a, risk) * diversificationFactor(a, assets),
          10,
          120,
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

  if (!lines.length) {
    return { ...empty, note: "Le versement est trop faible pour être réparti sur vos supports." };
  }

  // Arrondis : le total doit retomber exactement sur le versement.
  const total = lines.reduce((s, l) => s + l.amount, 0);
  for (const l of lines) l.amount = Math.round((l.amount * dca) / total);
  const rounded = lines.reduce((s, l) => s + l.amount, 0);
  if (lines[0] && rounded !== dca) lines[0].amount += dca - rounded;
  for (const l of lines) l.weight = Math.round((l.amount / dca) * 100);
  lines.sort((a, b) => b.amount - a.amount);

  const classes: ClassView[] = (["actions", "securise", "reels"] as InvestClass[])
    .filter((c) => netOf(c) > 0 || open.includes(c))
    .map((c) => ({
      cls: c,
      current: current(c),
      target: target(c),
      share: (lines.filter((l) => l.cls === c).reduce((s, l) => s + l.amount, 0) / dca) * 100,
    }));

  return { lines, classes, buffer, manual: false };
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
