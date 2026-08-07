import { assetValue, lookThrough, REGION_BUCKETS, type RegionBucket } from "./calc";
import type { Analysis } from "./signals";
import type { Asset, Profile } from "./types";

/**
 * Plan de versement mensuel.
 *
 * Il ne propose que des lignes déjà détenues : renforcer ce qu'on
 * connaît plutôt que disperser sur des supports jamais ouverts. Les
 * montants sont répartis au prorata du score de chaque ligne, qui
 * combine performance ajustée du risque, risque et tendance.
 */

/** Nombre de mois de revenus au-delà duquel l'épargne de précaution est jugée suffisante. */
export const BUFFER_MONTHS = 10;

const SAFE_TYPES: Array<Asset["type"]> = ["livret", "cash"];

interface BufferStatus {
  /** Total livrets + cash, en euros. */
  amount: number;
  /** Équivalent en mois de revenus, si les revenus sont connus. */
  months?: number;
  /** L'épargne de précaution dépasse-t-elle le seuil ? */
  sufficient: boolean;
}

function bufferStatus(assets: Asset[], profile: Profile | null): BufferStatus {
  const amount = assets
    .filter((a) => SAFE_TYPES.includes(a.type))
    .reduce((s, a) => s + assetValue(a), 0);

  const income = profile?.incomeMonthly ?? 0;
  if (income <= 0) return { amount, sufficient: false };

  const months = amount / income;
  return { amount, months, sufficient: months >= BUFFER_MONTHS };
}

/**
 * Part de chaque zone dans la poche actions, et zone dominante d'une ligne.
 * Sert à freiner le renforcement de ce qui pèse déjà lourd : un plan qui
 * ne regarde que la performance concentre mécaniquement le portefeuille
 * sur ce qui vient de monter.
 */
function regionShares(assets: Asset[]): Record<RegionBucket, number> {
  const lt = lookThrough(assets);
  const total = REGION_BUCKETS.reduce((s, r) => s + lt[r], 0);
  const out = Object.fromEntries(REGION_BUCKETS.map((r) => [r, 0])) as Record<RegionBucket, number>;
  if (total <= 0) return out;
  for (const r of REGION_BUCKETS) out[r] = (lt[r] / total) * 100;
  return out;
}

/** Zone d'exposition principale d'une ligne. */
function mainRegion(a: Asset): RegionBucket | null {
  const region = String(a.data["region"] ?? "");
  if ((REGION_BUCKETS as readonly string[]).includes(region)) return region as RegionBucket;
  // Un ETF monde est majoritairement américain : c'est ce qui compte
  // pour juger d'une surexposition.
  if (region === "Monde") return "États-Unis";
  return null;
}

/**
 * Coefficient appliqué au poids d'une ligne selon la place que sa zone
 * occupe déjà. Au-delà d'un tiers du portefeuille actions, le
 * renforcement est progressivement freiné, sans jamais être annulé :
 * l'objectif est de rééquilibrer, pas d'exclure.
 */
function concentrationFactor(share: number): number {
  if (share <= 35) return 1;
  if (share >= 70) return 0.4;
  return 1 - ((share - 35) / 35) * 0.6;
}

export interface PlanLine {
  assetId: string;
  label: string;
  /** Part du versement, en pourcentage. */
  weight: number;
  amount: number;
  /** Score de la ligne, pour l'affichage. */
  score: number;
  signal: Analysis["signal"];
  /** Renseigné quand le poids a été réduit pour cause de concentration. */
  concentrationNote?: string;
}

export interface PlanResult {
  lines: PlanLine[];
  buffer: BufferStatus;
  /** Explication affichée quand aucune ligne n'est proposée. */
  note?: string;
}

/**
 * Répartit le versement entre les meilleures lignes détenues.
 *
 * Règles :
 *  - seules les lignes analysables (historique suffisant) entrent ;
 *  - les lignes en signal « alléger » sont écartées : on ne renforce pas
 *    ce qu'on envisage de réduire ;
 *  - livrets et cash sont exclus dès que l'épargne de précaution atteint
 *    dix mois de revenus, l'argent ayant alors plus d'intérêt ailleurs ;
 *  - cinq lignes au maximum, pondérées par leur score.
 */
export function buildPlanFromHoldings(
  assets: Asset[],
  analyses: Map<string, Analysis>,
  profile: Profile | null,
  dca: number,
): PlanResult {
  const buffer = bufferStatus(assets, profile);

  const candidates = assets
    .map((a) => ({ asset: a, analysis: analyses.get(a.id) }))
    .filter(
      (c): c is { asset: Asset; analysis: Analysis } =>
        c.analysis !== undefined && c.analysis.signal !== "alleger",
    );

  // L'épargne de précaution n'est renforcée que tant qu'elle est
  // insuffisante ; au-delà, elle sort du plan.
  const safe = buffer.sufficient
    ? []
    : assets.filter((a) => SAFE_TYPES.includes(a.type)).slice(0, 1);

  const ranked = candidates.sort((a, b) => b.analysis.score - a.analysis.score).slice(0, 5);

  if (!ranked.length && !safe.length) {
    return {
      lines: [],
      buffer,
      note: "Aucune ligne ne réunit assez d'historique pour être classée, ou toutes sont en signal Alléger.",
    };
  }

  const shares = regionShares(assets);

  const weighted: Array<{
    id: string;
    label: string;
    weight: number;
    score: number;
    signal: Analysis["signal"];
    note?: string;
  }> = ranked.map((c) => {
    const region = mainRegion(c.asset);
    const share = region ? shares[region] : 0;
    const factor = region ? concentrationFactor(share) : 1;
    return {
      id: c.asset.id,
      label: String(c.asset.data["name"] ?? c.analysis.symbol),
      // Le score sert de poids ; le décalage évite qu'une ligne à 0
      // disparaisse complètement du plan.
      weight: Math.max(5, c.analysis.score) * factor,
      score: c.analysis.score,
      signal: c.analysis.signal,
      ...(factor < 1 && region
        ? { note: `${region} pèse déjà ${Math.round(share)} % de tes actions` }
        : {}),
    };
  });

  for (const a of safe) {
    weighted.push({
      id: a.id,
      label: `${String(a.data["name"] ?? "Épargne de précaution")} (précaution)`,
      // Part fixe : compléter le matelas prime tant qu'il est incomplet.
      weight: 40,
      score: 0,
      signal: "conserver",
    });
  }

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  const lines = weighted.map((w) => ({
    assetId: w.id,
    label: w.label,
    weight: Math.round((w.weight / total) * 100),
    amount: Math.round((dca * w.weight) / total),
    score: w.score,
    signal: w.signal,
    ...(w.note ? { concentrationNote: w.note } : {}),
  }));

  return { lines, buffer };
}

/**
 * Décision du mois : une seule phrase, celle qui compte.
 *
 * L'accueil n'affiche que ça. La hiérarchie suit l'urgence réelle :
 * un matelas de sécurité incomplet prime sur l'optimisation, une
 * concentration excessive prime sur la performance, et à défaut on
 * renforce la meilleure ligne. Tout est calculé ici, l'écran ne fait
 * que rendre le résultat.
 */
export function monthlyDecision(
  plan: PlanResult,
  dca: number,
  diversification: number,
): { headline: string; detail: string } | null {
  if (dca <= 0) return null;

  const [first] = plan.lines;
  if (!first) {
    return {
      headline: "Rien à répartir pour l'instant",
      detail: plan.note ?? "Ajoute des lignes avec leur ticker pour obtenir un plan.",
    };
  }

  const fmt = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  // 1. L'épargne de précaution avant tout : sans matelas, un imprévu
  //    oblige à vendre au mauvais moment.
  if (!plan.buffer.sufficient && plan.buffer.months !== undefined) {
    const manque = Math.max(0, BUFFER_MONTHS - plan.buffer.months);
    return {
      headline: `Complète ton épargne de précaution`,
      detail: `${plan.buffer.months.toFixed(1)} mois couverts sur ${BUFFER_MONTHS} : il te manque environ ${manque.toFixed(1)} mois avant d'investir davantage.`,
    };
  }

  // 2. Concentration : une ligne freinée signale un déséquilibre.
  const freinee = plan.lines.find((l) => l.concentrationNote);
  if (freinee && diversification < 55) {
    return {
      headline: `Rééquilibre : ${fmt.format(first.amount)} sur ${first.label}`,
      detail: `${freinee.concentrationNote}. Le plan réduit son renforcement pour remonter ta diversification (${diversification}/100).`,
    };
  }

  // 3. Cas courant : renforcer la ligne la mieux notée.
  return {
    headline: `${fmt.format(first.amount)} sur ${first.label}`,
    detail: `Ta ligne la mieux notée ce mois-ci. ${plan.lines.length > 1 ? `Le reste se répartit sur ${plan.lines.length - 1} autre${plan.lines.length > 2 ? "s" : ""} ligne${plan.lines.length > 2 ? "s" : ""}.` : ""}`,
  };
}
