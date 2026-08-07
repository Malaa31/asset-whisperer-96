import { assetValue } from "./calc";
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

export interface BufferStatus {
  /** Total livrets + cash, en euros. */
  amount: number;
  /** Équivalent en mois de revenus, si les revenus sont connus. */
  months?: number;
  /** L'épargne de précaution dépasse-t-elle le seuil ? */
  sufficient: boolean;
}

export function bufferStatus(assets: Asset[], profile: Profile | null): BufferStatus {
  const amount = assets
    .filter((a) => SAFE_TYPES.includes(a.type))
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
  /** Score de la ligne, pour l'affichage. */
  score: number;
  signal: Analysis["signal"];
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

  const weighted: Array<{ id: string; label: string; weight: number; score: number; signal: Analysis["signal"] }> =
    ranked.map((c) => ({
      id: c.asset.id,
      label: String(c.asset.data["name"] ?? c.analysis.symbol),
      // Le score sert de poids ; le décalage évite qu'une ligne à 0
      // disparaisse complètement du plan.
      weight: Math.max(5, c.analysis.score),
      score: c.analysis.score,
      signal: c.analysis.signal,
    }));

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
  }));

  return { lines, buffer };
}
