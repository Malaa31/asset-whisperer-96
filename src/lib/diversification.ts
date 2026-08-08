import { assetValue, lookThrough, REGION_BUCKETS, type RegionBucket } from "./calc";
import type { Asset } from "./types";

/**
 * Diversification géographique en transparence.
 *
 * Une ligne ne s'apprécie pas isolément : un ETF Monde contient déjà
 * environ 71 % d'actions américaines et 18 % d'européennes. Renforcer
 * Monde et Europe en même temps double l'exposition européenne sans que
 * cela se voie, et concentre encore davantage sur les États-Unis.
 *
 * On mesure donc l'effet marginal de chaque euro versé sur une ligne :
 * rapproche-t-il la répartition géographique de la cible, ou l'en
 * éloigne-t-il ?
 */

/**
 * Cible géographique, à la pondération des marchés mondiaux, avec une
 * part émergente légèrement relevée : leur poids boursier sous-estime
 * leur poids économique, et l'écart de valorisation les rend moins
 * corrélés au reste.
 */
const REGION_TARGET: Partial<Record<RegionBucket, number>> = {
  "États-Unis": 0.6,
  Europe: 0.18,
  Émergents: 0.14,
  Japon: 0.05,
  "Autres dév.": 0.03,
};

/** Régions prises en compte dans l'écart : les poches actions seulement. */
const EQUITY_REGIONS: RegionBucket[] = REGION_BUCKETS.filter(
  (r) => r !== "Fonds €" && r !== "Commodities",
);

/** Répartition géographique d'une ligne, en parts sommant à 1. */
export function regionSplitOf(asset: Asset): Partial<Record<RegionBucket, number>> {
  const one = { ...asset, data: { ...asset.data } };
  const lt = lookThrough([one]);
  const total = EQUITY_REGIONS.reduce((s, r) => s + lt[r], 0);
  if (total <= 0) return {};
  return Object.fromEntries(EQUITY_REGIONS.map((r) => [r, lt[r] / total]));
}

/**
 * Coefficient de diversification d'une ligne, entre 0,6 et 1,4.
 *
 * Au-dessus de 1, la ligne comble un manque géographique ; en dessous,
 * elle renforce une zone déjà surreprésentée. Le facteur module le poids
 * de la ligne dans sa poche, sans jamais l'exclure : une ligne de qualité
 * reste retenue, elle reçoit simplement moins.
 */
export function diversificationFactor(asset: Asset, portfolio: Asset[]): number {
  const split = regionSplitOf(asset);
  if (!Object.keys(split).length) return 1;

  const lt = lookThrough(portfolio);
  const total = EQUITY_REGIONS.reduce((s, r) => s + lt[r], 0);
  // Portefeuille actions encore vide : aucune concentration à corriger.
  if (total <= 0) return 1;

  // Somme, pondérée par l'exposition de la ligne, des écarts à la cible.
  // Un écart positif signifie que la région manque au portefeuille.
  let benefit = 0;
  for (const r of EQUITY_REGIONS) {
    const share = split[r] ?? 0;
    if (share <= 0) continue;
    const current = lt[r] / total;
    const target = REGION_TARGET[r] ?? 0;
    benefit += share * (target - current);
  }

  // Un écart de dix points se traduit par environ vingt pour cent de
  // poids en plus ou en moins : sensible, sans écraser la qualité.
  return Math.min(1.4, Math.max(0.6, 1 + benefit * 2));
}
