import { assetValue } from "./calc";
import { BUFFER_BY_PROFILE } from "./policy";
import type { Asset, Goal, Profile } from "./types";

/**
 * Classification et garde-fous du plan.
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

/**
 * Part maximale d'actions tolérée selon l'horizon restant de l'objectif.
 *
 * Un capital nécessaire dans deux ans ne se joue pas en bourse : la
 * probabilité de perte sur douze mois reste trop élevée pour une somme
 * dont la date est fixée. La contrainte se relâche progressivement et
 * disparaît au-delà de dix ans, où la dispersion des rendements actions
 * redevient acceptable.
 */
export function horizonEquityCap(horizon: number): number {
  if (horizon <= 1) return 5;
  if (horizon <= 3) return 30;
  if (horizon <= 5) return 55;
  if (horizon <= 8) return 80;
  if (horizon <= 10) return 92;
  return 100;
}

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
    // Le plan du mois est un plan de placement financier : ni pierre
    // (même papier), ni livret. Seuls les métaux logés là restent
    // abondables, faute de meilleure enveloppe dans l'app.
    const label = `${a.data["name"] ?? ""} ${a.data["type"] ?? ""} ${a.data["sector"] ?? ""}`;
    return METALS.test(label) && !PAPER_REALESTATE.test(label);
  }
  // Un livret ou un compte courant est une réserve, pas un placement :
  // il relève du message d'épargne de précaution, pas du versement.
  if (a.type === "livret" || a.type === "cash") return false;
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
