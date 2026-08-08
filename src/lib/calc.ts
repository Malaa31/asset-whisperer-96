import type { Asset } from "./types";

export function n(v: unknown): number {
  const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function assetValue(a: Asset): number {
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

// --- Répartition & diversification ---

/** Valeur positive par classe d'actif (les crédits sont exclus). */
/**
 * Répartition par classe, en valeurs nettes de dettes.
 *
 * Les crédits s'imputent sur l'actif qu'ils financent : un bien de
 * 200 000 € grevé de 147 000 € d'encours pèse 53 000 €, pas 200 000.
 * Sans cette imputation, la répartition affichée contredirait le plan du
 * mois, qui raisonne déjà en net.
 */
export function allocationByType(assets: Asset[]): Array<{ type: Asset["type"]; value: number }> {
  const map = new Map<Asset["type"], number>();
  for (const a of assets) {
    if (a.type === "credit") continue;
    const v = assetValue(a);
    if (v <= 0) continue;
    map.set(a.type, (map.get(a.type) ?? 0) + v);
  }

  // Les crédits réduisent l'immobilier en priorité — ce sont très
  // majoritairement des prêts immobiliers — puis le reste au prorata.
  let debt = assets
    .filter((a) => a.type === "credit")
    .reduce((s, a) => s + Math.abs(assetValue(a)), 0);
  if (debt > 0) {
    const immo = map.get("immo") ?? 0;
    const onImmo = Math.min(immo, debt);
    if (onImmo > 0) map.set("immo", immo - onImmo);
    debt -= onImmo;
    if (debt > 0) {
      const rest = [...map.entries()].filter(([, v]) => v > 0);
      const restSum = rest.reduce((s, [, v]) => s + v, 0);
      for (const [t, v] of rest) {
        map.set(t, Math.max(0, v - (restSum > 0 ? (debt * v) / restSum : 0)));
      }
    }
  }

  return [...map.entries()]
    .filter(([, value]) => value > 0)
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
