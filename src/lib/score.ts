import { assetValue } from "./calc";
import { classOf, isBuffer } from "./plan";
import { exposure, type Sector } from "./classify";
import { REGION_TARGET, SECTOR_TARGET } from "./policy";
import { TYPE_LABELS, type Asset } from "./types";

/**
 * Score de diversification multi-axes.
 *
 * Un indice de concentration seul dit peu de chose : un portefeuille
 * réparti à parts égales entre quatre ETF S&P 500 obtiendrait 100 alors
 * qu'il ne détient qu'une seule exposition. Cinq axes complémentaires
 * sont donc mesurés, chacun sur 100, puis agrégés par une moyenne
 * pondérée :
 *
 *   1. classes d'actifs  — répartition entre les grandes poches ;
 *   2. régions           — écart à une allocation mondiale, en transparence ;
 *   3. secteurs          — écart à une répartition sectorielle raisonnable ;
 *   4. lignes            — nombre effectif de positions (Herfindahl inversé) ;
 *   5. enveloppes        — dispersion fiscale et liquidité de secours.
 *
 * L'agrégation n'est pas une moyenne simple mais une moyenne pondérée
 * corrigée par le maillon faible : un axe très bas plafonne le global,
 * parce qu'une seule concentration suffit à faire mal.
 */

/** Nombre de lignes au-delà duquel l'ajout d'une position n'apporte plus grand-chose. */
const TARGET_POSITIONS = 12;

export type AxisKey = "classes" | "regions" | "sectors" | "holdings" | "envelopes";

export interface Axis {
  key: AxisKey;
  label: string;
  score: number;
  weight: number;
  /** Phrase courte expliquant ce que mesure l'axe et ce qui le pénalise. */
  hint: string;
}

export interface DiversificationReport {
  global: number;
  axes: Axis[];
  /** Axes les plus faibles, formulés en actions concrètes. */
  advice: string[];
  /** Compat : les anciens appels lisent ces deux champs. */
  classes: number;
  regions: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const pctOf = (v: number): number => Math.round(clamp01(v) * 100);

/** Herfindahl inversé : nombre effectif de cases réellement occupées. */
function effectiveCount(values: number[]): number {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return 0;
  const hhi = values.reduce((s, v) => s + (Math.max(0, v) / total) ** 2, 0);
  return hhi > 0 ? 1 / hhi : 0;
}

/**
 * Score d'équilibre : nombre effectif de cases rapporté au nombre de
 * cases disponibles, sur une échelle logarithmique — passer de une à
 * deux positions compte davantage que passer de dix à onze.
 */
function spreadScore(values: number[], buckets: number): number {
  const eff = effectiveCount(values);
  if (eff <= 0 || buckets < 2) return 0;
  return pctOf(Math.log(eff) / Math.log(buckets));
}

/**
 * Distance en variation totale à une répartition cible : 0 quand la
 * répartition colle à la cible, 1 quand elle est totalement ailleurs.
 */
function distanceToTarget(
  current: Record<string, number>,
  target: Record<string, number | undefined>,
): number | null {
  const total = Object.values(current).reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return null;
  const keys = new Set([...Object.keys(current), ...Object.keys(target)]);
  let d = 0;
  for (const k of keys) {
    const p = Math.max(0, current[k] ?? 0) / total;
    const q = target[k] ?? 0;
    d += Math.abs(p - q);
  }
  return d / 2;
}

export function diversificationReport(
  assets: Asset[],
  realSectors?: Map<string, Partial<Record<Sector, number>>>,
): DiversificationReport {
  const positive = assets.filter((a) => a.type !== "credit" && assetValue(a) > 0);

  // ── 1. Classes ──
  const byClass = new Map<string, number>();
  for (const a of positive) {
    const key = classOf(a) ?? (isBuffer(a) ? "matelas" : "autre");
    byClass.set(key, (byClass.get(key) ?? 0) + assetValue(a));
  }
  const classes = spreadScore([...byClass.values()], 4);

  // ── 2 & 3. Régions et secteurs, en transparence ──
  const { regions, sectors } = exposure(positive, (a) => Math.max(0, assetValue(a)), realSectors);
  const dr = distanceToTarget(regions, REGION_TARGET);
  const ds = distanceToTarget(sectors, SECTOR_TARGET);
  const regionScore = dr === null ? 0 : pctOf(1 - dr);
  const sectorScore = ds === null ? 0 : pctOf(1 - ds);

  // ── 4. Lignes ──
  const invested = positive.filter((a) => classOf(a) !== null);
  const holdings = invested.length
    ? pctOf(Math.log(1 + effectiveCount(invested.map(assetValue))) / Math.log(1 + TARGET_POSITIONS))
    : 0;

  // ── 5. Enveloppes ──
  // Trois enveloppes distinctes suffisent à couvrir les régimes utiles
  // (capitalisation, assurance vie, liquidités) ; au-delà le gain est
  // marginal. Un matelas absent coûte un quart de l'axe : sans réserve,
  // la moindre dépense force à vendre au pire moment.
  const byEnvelope = new Map<string, number>();
  for (const a of positive) byEnvelope.set(a.type, (byEnvelope.get(a.type) ?? 0) + assetValue(a));
  const envSpread = spreadScore([...byEnvelope.values()], 4);
  const hasBuffer = assets.some((a) => isBuffer(a) && assetValue(a) > 0);
  const envelopes = Math.round(envSpread * (hasBuffer ? 1 : 0.75));

  const axes: Axis[] = [
    {
      key: "classes",
      label: "Classes d'actifs",
      score: classes,
      weight: 0.25,
      hint: "Équilibre entre actions, sécurisé et actifs réels.",
    },
    {
      key: "regions",
      label: "Régions",
      score: regionScore,
      weight: 0.25,
      hint: "Écart à une exposition mondiale, ETF éclatés en transparence.",
    },
    {
      key: "sectors",
      label: "Secteurs",
      score: sectorScore,
      weight: 0.2,
      hint: "Écart à une répartition sectorielle équilibrée.",
    },
    {
      key: "holdings",
      label: "Lignes",
      score: holdings,
      weight: 0.15,
      hint: "Nombre effectif de positions, pondéré par leur poids réel.",
    },
    {
      key: "envelopes",
      label: "Enveloppes",
      score: envelopes,
      weight: 0.15,
      hint: "Dispersion fiscale et présence d'un matelas de précaution.",
    },
  ];

  const weighted = axes.reduce((s, a) => s + a.score * a.weight, 0);
  // Correction du maillon faible : le global ne dépasse jamais de plus
  // de 25 points l'axe le plus mal noté.
  const weakest = Math.min(...axes.map((a) => a.score));
  const global = Math.round(Math.min(weighted, weakest + 25));

  const advice = axes
    .filter((a) => a.score < 55)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((a) => ADVICE[a.key]);

  return { global, axes, advice, classes, regions: regionScore };
}

const ADVICE: Record<AxisKey, string> = {
  classes: "Une seule poche porte presque tout : un support sécurisé ou réel amortirait les à-coups.",
  regions: "L'exposition géographique s'écarte des marchés mondiaux : un ETF large rééquilibrerait.",
  sectors: "Un secteur pèse trop lourd en transparence : privilégier un support généraliste.",
  holdings: "Trop peu de lignes portent le portefeuille : une position isolée fait bouger le total.",
  envelopes: "Peu d'enveloppes utilisées, ou pas de matelas : la liquidité de secours manque.",
};

/** Libellé lisible d'une enveloppe, pour l'affichage des conseils. */
export const envelopeLabel = (t: Asset["type"]): string => TYPE_LABELS[t];
