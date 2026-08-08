import { assetValue } from "./calc";
import { exposure, regionSplit, sectorSplit, type Region, type Sector } from "./classify";
import type { Asset } from "./types";

/**
 * Diversification en transparence, sur deux axes : géographique et
 * sectoriel.
 *
 * Une ligne ne s'apprécie pas isolément. Un ETF Monde contient déjà
 * environ 71 % d'actions américaines et 26 % de technologie : le
 * renforcer aux côtés d'un S&P 500 et d'un fonds technologique concentre
 * trois fois la même exposition sans que cela se voie.
 *
 * On mesure donc l'effet marginal de chaque euro versé : rapproche-t-il
 * la répartition des cibles, ou l'en éloigne-t-il ?
 */

/**
 * Cible géographique, à la pondération des marchés mondiaux, avec une
 * part émergente relevée : leur poids boursier sous-estime leur poids
 * économique et leur valorisation les rend moins corrélés.
 */
const REGION_TARGET: Partial<Record<Region, number>> = {
  "États-Unis": 0.6,
  Europe: 0.18,
  Émergents: 0.14,
  Japon: 0.05,
  "Autres dév.": 0.03,
};

/**
 * Cible sectorielle, proche de la répartition mondiale mais avec la
 * technologie ramenée sous son poids de marché : elle y dépasse le quart
 * de l'indice, ce qui constitue une concentration en soi.
 */
const SECTOR_TARGET: Partial<Record<Sector, number>> = {
  Technologie: 0.22,
  Finance: 0.17,
  Santé: 0.13,
  Consommation: 0.18,
  Industrie: 0.12,
  Énergie: 0.05,
  Matériaux: 0.05,
  "Services publics": 0.04,
  Immobilier: 0.04,
};

/** Poids de l'axe géographique face à l'axe sectoriel. */
const REGION_WEIGHT = 0.6;

/**
 * Écart pondéré d'une ligne à une cible : positif si elle comble un
 * manque, négatif si elle renforce une zone déjà surreprésentée.
 */
function benefitOf(
  split: Record<string, number | undefined>,
  current: Record<string, number>,
  target: Record<string, number | undefined>,
): number {
  const total = Object.values(current).reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let benefit = 0;
  for (const [key, share] of Object.entries(split)) {
    if (!share) continue;
    benefit += share * ((target[key] ?? 0) - (current[key] ?? 0) / total);
  }
  return benefit;
}

/**
 * Coefficient de diversification d'une ligne, entre 0,6 et 1,4.
 *
 * Au-dessus de 1, elle comble un manque ; en dessous, elle renforce une
 * exposition déjà pleine. Le facteur module le poids sans jamais exclure
 * la ligne : un bon support reste retenu, il reçoit simplement moins.
 */
export function diversificationFactor(
  asset: Asset,
  portfolio: Asset[],
  real?: Map<string, Partial<Record<Sector, number>>>,
): number {
  const rSplit = regionSplit(asset);
  const sSplit = sectorSplit(asset, real);
  if (!Object.keys(rSplit).length && !Object.keys(sSplit).length) return 1;

  const { regions, sectors } = exposure(portfolio, (a) => Math.max(0, assetValue(a)), real);
  const rBenefit = benefitOf(rSplit, regions, REGION_TARGET);
  const sBenefit = benefitOf(sSplit, sectors, SECTOR_TARGET);
  const benefit = REGION_WEIGHT * rBenefit + (1 - REGION_WEIGHT) * sBenefit;

  // Un écart de dix points vaut environ vingt pour cent de poids en plus
  // ou en moins : sensible, sans écraser la qualité de la ligne.
  return Math.min(1.4, Math.max(0.6, 1 + benefit * 2));
}

/** Exposition du portefeuille, pour l'affichage. */
export function portfolioExposure(
  assets: Asset[],
  real?: Map<string, Partial<Record<Sector, number>>>,
) {
  return exposure(assets, (a) => Math.max(0, assetValue(a)), real);
}
