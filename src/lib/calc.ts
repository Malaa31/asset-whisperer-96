import { canConvert, toEur } from "./fx";
import type { Asset } from "./types";

export function n(v: unknown): number {
  const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Valeur d'une ligne, exprimée en euros.
 * Les montants sont stockés dans leur devise d'origine : la conversion
 * se fait ici, au moment du calcul, avec les derniers taux BCE connus.
 */
export function assetValue(a: Asset): number {
  return toEur(assetValueRaw(a), a.data["currency"]);
}

/** Valeur dans la devise de la ligne, sans conversion. */
function assetValueRaw(a: Asset): number {
  const d = a.data;
  switch (a.type) {
    case "pea":
      return n(d["quantity"]) * (n(d["currentPrice"]) || n(d["pru"]));
    case "av":
      return n(d["fondsEurosAmount"]) + n(d["ucAmount"]);
    case "immo":
      return n(d["valeurEstimee"]);
    case "crypto":
      return n(d["quantity"]) * n(d["prixUnitaire"]);
    case "credit":
      return -n(d["capitalRestant"]);
    default:
      return n(d["amount"]);
  }
}

export function assetGain(a: Asset): number {
  if (a.type !== "pea") return 0;
  const cp = n(a.data["currentPrice"]);
  if (!cp) return 0;
  return n(a.data["quantity"]) * (cp - n(a.data["pru"]));
}

export function totals(assets: Asset[]) {
  let actifs = 0;
  let dettes = 0;
  let gain = 0;
  for (const a of assets) {
    const v = assetValue(a);
    if (a.type === "credit") dettes += Math.abs(v);
    else actifs += v;
    gain += assetGain(a);
  }
  return { actifs, dettes, gain, net: actifs - dettes };
}

// --- Allocation en transparence (look-through) ---
export const REGION_BUCKETS = [
  "États-Unis",
  "Europe",
  "Émergents",
  "Japon",
  "Autres dév.",
  "Commodities",
  "Fonds €",
] as const;
export type RegionBucket = (typeof REGION_BUCKETS)[number];

const WORLD_SPLIT: Array<[RegionBucket, number]> = [
  ["États-Unis", 0.71],
  ["Europe", 0.185],
  ["Japon", 0.06],
  ["Autres dév.", 0.045],
];

export function lookThrough(assets: Asset[]): Record<RegionBucket, number> {
  const out = Object.fromEntries(REGION_BUCKETS.map((r) => [r, 0])) as Record<
    RegionBucket,
    number
  >;
  for (const a of assets) {
    const v = assetValue(a);
    if (a.type === "av") {
      out["Fonds €"] += n(a.data["fondsEurosAmount"]);
      const uc = n(a.data["ucAmount"]);
      for (const [r, w] of WORLD_SPLIT) out[r] += uc * w;
      continue;
    }
    if (a.type !== "pea") continue;
    const sector = String(a.data["sector"] ?? "").toLowerCase();
    if (/matière|matiere|commodit|mine|or\b/.test(sector)) {
      out["Commodities"] += v;
      continue;
    }
    const region = String(a.data["region"] ?? "Monde");
    if (region === "Monde") for (const [r, w] of WORLD_SPLIT) out[r] += v * w;
    else if (region === "États-Unis") out["États-Unis"] += v;
    else if (region === "Europe") out["Europe"] += v;
    else if (region === "Émergents") out["Émergents"] += v;
    else if (region === "Japon") out["Japon"] += v;
    else out["Autres dév."] += v;
  }
  return out;
}

/**
 * Lignes libellées dans une autre devise que l'euro.
 * Les totaux additionnent les montants tels quels : une ligne en dollars
 * fausse donc le patrimoine net tant qu'elle n'est pas convertie à la main.
 * On les signale plutôt que de laisser l'erreur passer inaperçue.
 */
export function foreignCurrencyAssets(assets: Asset[]): Asset[] {
  return assets.filter((a) => !canConvert(a.data["currency"]));
}

// --- Répartition & diversification ---

/** Valeur positive par classe d'actif (les crédits sont exclus). */
export function allocationByType(assets: Asset[]): Array<{ type: Asset["type"]; value: number }> {
  const map = new Map<Asset["type"], number>();
  for (const a of assets) {
    if (a.type === "credit") continue;
    const v = assetValue(a);
    if (v <= 0) continue;
    map.set(a.type, (map.get(a.type) ?? 0) + v);
  }
  return [...map.entries()]
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value);
}

/** Indice de Herfindahl-Hirschman normalisé → score 0-100 (100 = réparti à parts égales sur N cases). */
function hhiScore(values: number[], bucketCount: number): number {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0 || bucketCount < 2) return 0;
  const hhi = values.reduce((s, v) => s + (v / total) ** 2, 0);
  const min = 1 / bucketCount;
  return Math.round(Math.max(0, Math.min(1, (1 - (hhi - min) / (1 - min)))) * 100);
}

export interface DiversificationScore {
  /** Score global 0-100 (moyenne des deux composantes). */
  global: number;
  /** Répartition entre classes d'actifs (bourse, AV, livrets, immo…). */
  classes: number;
  /** Répartition géographique des actions, en transparence des ETF. */
  regions: number;
}

export function diversificationScore(assets: Asset[]): DiversificationScore {
  const classes = hhiScore(allocationByType(assets).map((x) => x.value), 6);
  const lt = lookThrough(assets);
  const regions = hhiScore(Object.values(lt).filter((v) => v > 0.01), REGION_BUCKETS.length);
  return { classes, regions, global: Math.round((classes + regions) / 2) };
}

// --- Projection ---
export function project(start: number, dca: number, years: number, rate = 0.075) {
  const points: Array<{ annee: number; valeur: number; verse: number }> = [];
  let value = start;
  let verse = start;
  points.push({ annee: 0, valeur: Math.round(value), verse: Math.round(verse) });
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = value * (1 + rate / 12) + dca;
      verse += dca;
    }
    points.push({ annee: y, valeur: Math.round(value), verse: Math.round(verse) });
  }
  return points;
}

// --- Crédit ---
export function mensualite(capital: number, tauxAnnuel: number, annees: number) {
  const r = tauxAnnuel / 100 / 12;
  const nb = annees * 12;
  if (!r) return nb ? capital / nb : 0;
  return (capital * r) / (1 - Math.pow(1 + r, -nb));
}
