import { assetValue } from "./calc";
import type { Analysis } from "./signals";
import type { Asset, Profile } from "./types";

/**
 * Plan de versement mensuel.
 *
 * Il ne propose que des lignes déjà détenues : renforcer ce qu'on
 * connaît plutôt que disperser sur des supports jamais ouverts. Les
 * montants suivent le score de chaque ligne, qui combine performance
 * ajustée du risque, risque et tendance.
 */

/** Seuil au-delà duquel l'épargne de précaution est jugée suffisante. */
export const BUFFER_MONTHS = 10;

const SAFE_TYPES: Array<Asset["type"]> = ["livret", "cash"];

/**
 * Une ligne compte-t-elle comme épargne de précaution ?
 *
 * Les liquidités logées dans une enveloppe d'investissement — espèces
 * d'un PEA ou d'un CTO en attente d'être investies — n'en sont pas :
 * elles sont bloquées fiscalement et destinées au marché, pas à couvrir
 * un imprévu.
 */
function isEmergencySavings(a: Asset): boolean {
  if (!SAFE_TYPES.includes(a.type)) return false;
  const label = `${a.data["name"] ?? ""} ${a.data["envelope"] ?? ""}`.toLowerCase();
  return !/\b(pea|cto|pee|per|compte[- ]titres?)\b/.test(label);
}

export interface BufferStatus {
  /** Total livrets + cash, en euros. */
  amount: number;
  /** Équivalent en mois de revenus, si les revenus sont connus. */
  months?: number;
  sufficient: boolean;
}

export function bufferStatus(assets: Asset[], profile: Profile | null): BufferStatus {
  const amount = assets
    .filter(isEmergencySavings)
    .reduce((s, a) => s + assetValue(a), 0);

  const income = profile?.incomeMonthly ?? 0;
  if (income <= 0) return { amount, sufficient: false };

  const months = amount / income;
  return { amount, months, sufficient: months >= BUFFER_MONTHS };
}

export interface PlanLine {
  assetId: string;
  label: string;
  /** Part du versement, en pourcentage. */
  weight: number;
  amount: number;
  score: number;
  signal: Analysis["signal"];
  /** Part actuelle de la ligne dans le portefeuille investi (%). */
  currentShare?: number;
  /** Ajustement applique au titre de la concentration (%). */
  diversificationAdjust?: number;
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
 *  - seules les lignes analysables entrent (deux ans d'historique) ;
 *  - les lignes en signal « alléger » sont écartées : on ne renforce pas
 *    ce qu'on envisage de réduire ;
 *  - livrets et cash sortent du plan dès que l'épargne de précaution
 *    atteint dix mois de revenus, l'argent ayant alors plus d'intérêt
 *    ailleurs ;
 *  - cinq lignes au maximum, pondérées par leur score.
 */
export function buildPlanFromHoldings(
  assets: Asset[],
  analyses: Map<string, Analysis>,
  profile: Profile | null,
  dca: number,
  /** Lignes écartées manuellement du plan. */
  excluded: string[] = [],
): PlanResult {
  const buffer = bufferStatus(assets, profile);

  const eligible = assets
    .map((a) => ({ asset: a, analysis: analyses.get(a.id) }))
    .filter(
      (c): c is { asset: Asset; analysis: Analysis } =>
        c.analysis !== undefined &&
        c.analysis.signal !== "alleger" &&
        !excluded.includes(c.asset.id),
    );

  // Poids actuel de chaque ligne dans la poche investie : sert à corriger
  // la concentration. Renforcer sans cesse la ligne la plus grosse
  // dégrade la diversification, même si son score est le meilleur.
  const investedTotal = eligible.reduce((s, c) => s + Math.max(0, assetValue(c.asset)), 0);
  const target = eligible.length ? 100 / eligible.length : 0;

  const ranked = eligible
    .map((c) => {
      const share = investedTotal > 0 ? (assetValue(c.asset) / investedTotal) * 100 : 0;
      // Écart à une répartition égale, borné : une ligne deux fois trop
      // grosse voit son poids réduit d'un tiers au maximum, une ligne
      // sous-représentée gagne autant.
      const gap = target > 0 ? (target - share) / target : 0;
      const adjust = Math.max(-0.33, Math.min(0.33, gap * 0.5));
      return { ...c, share, adjust };
    })
    .sort((a, b) => b.analysis.score * (1 + b.adjust) - a.analysis.score * (1 + a.adjust))
    .slice(0, 5);

  // L'épargne de précaution n'est alimentée que tant qu'elle est
  // insuffisante ; au-delà du seuil, elle sort du plan.
  const safe = buffer.sufficient
    ? []
    : assets.filter(isEmergencySavings).slice(0, 1);

  if (!ranked.length && !safe.length) {
    return {
      lines: [],
      buffer,
      note: "Aucune ligne ne réunit assez d'historique pour être classée, ou toutes sont en signal Alléger.",
    };
  }

  const weighted = [
    ...ranked.map((c) => ({
      id: c.asset.id,
      label: String(c.asset.data["name"] ?? c.analysis.symbol),
      // Le score sert de poids, corrigé de la concentration ; le plancher
      // évite qu'une ligne disparaisse complètement du plan.
      weight: Math.max(5, c.analysis.score * (1 + c.adjust)),
      score: c.analysis.score,
      signal: c.analysis.signal,
      currentShare: c.share,
      adjust: Math.round(c.adjust * 100),
    })),
    ...safe.map((a) => ({
      id: a.id,
      label: `${String(a.data["name"] ?? "Épargne")} (précaution)`,
      // Part fixe : compléter le matelas prime tant qu'il est incomplet.
      weight: 40,
      score: 0,
      signal: "conserver" as const,
      currentShare: undefined as number | undefined,
      adjust: 0,
    })),
  ];

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  const lines: PlanLine[] = weighted.map((w) => ({
    assetId: w.id,
    label: w.label,
    weight: Math.round((w.weight / total) * 100),
    amount: Math.round((dca * w.weight) / total),
    score: w.score,
    signal: w.signal,
    ...(w.currentShare !== undefined ? { currentShare: w.currentShare } : {}),
    ...(w.adjust ? { diversificationAdjust: w.adjust } : {}),
  }));

  return { lines, buffer };
}
