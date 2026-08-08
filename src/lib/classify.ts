import { CATALOG } from "./catalog";
import type { Asset } from "./types";

/**
 * Identification de la région et du secteur d'une ligne.
 *
 * Une diversification ne vaut que si chaque support est correctement
 * situé. Trois sources, dans cet ordre : ce que l'utilisateur a saisi,
 * le catalogue interne, puis une déduction à partir du libellé et du
 * ticker. Les indices larges sont éclatés en transparence — un ETF
 * Monde n'est pas « une ligne monde », c'est une répartition.
 */

export const REGIONS = [
  "États-Unis",
  "Europe",
  "Japon",
  "Émergents",
  "Autres dév.",
] as const;
export type Region = (typeof REGIONS)[number];

export const SECTORS = [
  "Technologie",
  "Finance",
  "Santé",
  "Consommation",
  "Industrie",
  "Énergie",
  "Matériaux",
  "Services publics",
  "Immobilier",
  "Diversifié",
] as const;
export type Sector = (typeof SECTORS)[number];

type Split<T extends string> = Partial<Record<T, number>>;

/**
 * Répartitions sectorielles approchées des grands indices, à leur
 * pondération de capitalisation. Ce sont des ordres de grandeur stables
 * d'une année sur l'autre, suffisants pour mesurer une concentration.
 */
const SECTOR_MSCI_WORLD: Split<Sector> = {
  Technologie: 0.26,
  Finance: 0.16,
  Santé: 0.11,
  Consommation: 0.19,
  Industrie: 0.11,
  Énergie: 0.04,
  Matériaux: 0.04,
  "Services publics": 0.03,
  Immobilier: 0.02,
  Diversifié: 0.04,
};

const SECTOR_SP500: Split<Sector> = {
  Technologie: 0.33,
  Finance: 0.13,
  Santé: 0.11,
  Consommation: 0.2,
  Industrie: 0.08,
  Énergie: 0.03,
  Matériaux: 0.02,
  "Services publics": 0.025,
  Immobilier: 0.02,
  Diversifié: 0.035,
};

const SECTOR_EUROPE: Split<Sector> = {
  Technologie: 0.09,
  Finance: 0.21,
  Santé: 0.14,
  Consommation: 0.19,
  Industrie: 0.18,
  Énergie: 0.05,
  Matériaux: 0.06,
  "Services publics": 0.05,
  Immobilier: 0.01,
  Diversifié: 0.02,
};

const SECTOR_EMERGING: Split<Sector> = {
  Technologie: 0.26,
  Finance: 0.22,
  Consommation: 0.17,
  Industrie: 0.07,
  Énergie: 0.05,
  Matériaux: 0.07,
  Santé: 0.04,
  "Services publics": 0.03,
  Immobilier: 0.02,
  Diversifié: 0.07,
};

const REGION_WORLD: Split<Region> = {
  "États-Unis": 0.71,
  Europe: 0.185,
  Japon: 0.06,
  "Autres dév.": 0.045,
};

/** Motifs reconnus dans un libellé ou un ticker. */
const PATTERNS: Array<{
  re: RegExp;
  region: Split<Region>;
  sector: Split<Sector>;
}> = [
  {
    re: /\b(msci\s*world|world|monde|acwi|全世界)\b/i,
    region: REGION_WORLD,
    sector: SECTOR_MSCI_WORLD,
  },
  {
    re: /\b(s&?p\s*500|sp500|nasdaq|russell|us\b|usa|am[ée]rique)\b/i,
    region: { "États-Unis": 1 },
    sector: SECTOR_SP500,
  },
  {
    re: /\b(stoxx|euro\s*stoxx|europe|msci\s*europe|cac|dax|ftse)\b/i,
    region: { Europe: 1 },
    sector: SECTOR_EUROPE,
  },
  {
    re: /\b([ée]mergent|emerging|em\b|asie|asia|chine|china|inde|india|br[ée]sil|latam)\b/i,
    region: { Émergents: 1 },
    sector: SECTOR_EMERGING,
  },
  { re: /\b(japon|japan|topix|nikkei)\b/i, region: { Japon: 1 }, sector: SECTOR_EUROPE },
  {
    re: /\b(tech|technolog|semi|software|informatique|nasdaq)\b/i,
    region: { "États-Unis": 0.8, Europe: 0.15, Japon: 0.05 },
    sector: { Technologie: 1 },
  },
  {
    re: /\b([ée]nergie|energy|p[ée]trole|oil|gas|gaz)\b/i,
    region: { "États-Unis": 0.55, Europe: 0.3, "Autres dév.": 0.15 },
    sector: { Énergie: 1 },
  },
  {
    re: /\b(sant[ée]|health|pharma|biotech|m[ée]dical)\b/i,
    region: { "États-Unis": 0.65, Europe: 0.3, Japon: 0.05 },
    sector: { Santé: 1 },
  },
  {
    re: /\b(agricult|agro|food|alimentaire|nutrition)\b/i,
    region: { "États-Unis": 0.5, Europe: 0.3, Émergents: 0.2 },
    sector: { Consommation: 1 },
  },
  {
    re: /\b(banque|bank|financ|assur|insurance)\b/i,
    region: { "États-Unis": 0.5, Europe: 0.35, Émergents: 0.15 },
    sector: { Finance: 1 },
  },
  {
    re: /\b(immobilier|reit|scpi|opci|foncier)\b/i,
    region: { "États-Unis": 0.5, Europe: 0.4, "Autres dév.": 0.1 },
    sector: { Immobilier: 1 },
  },
  {
    re: /\b(or\b|gold|argent m[ée]tal|silver|mine|mati[èe]re|commodit)\b/i,
    region: { "Autres dév.": 1 },
    sector: { Matériaux: 1 },
  },
  {
    re: /\b(utilit|services publics|eau|water|electric)\b/i,
    region: { "États-Unis": 0.5, Europe: 0.4, Japon: 0.1 },
    sector: { "Services publics": 1 },
  },
];

/** Normalise une répartition pour qu'elle somme à 1. */
function normalize<T extends string>(split: Split<T>): Split<T> {
  const total = Object.values(split).reduce<number>((s, v) => s + (Number(v) || 0), 0);
  if (total <= 0) return {};
  return Object.fromEntries(
    Object.entries(split).map(([k, v]) => [k, (v as number) / total]),
  ) as Split<T>;
}

/** Texte servant à l'identification : libellé, ticker, ISIN, champs saisis. */
function textOf(a: Asset): string {
  return [a.data["name"], a.data["ticker"], a.data["isin"], a.data["sector"], a.data["region"]]
    .filter(Boolean)
    .join(" ");
}

/** Entrée du catalogue correspondant au ticker ou à l'ISIN de la ligne. */
function catalogEntry(a: Asset) {
  const ticker = String(a.data["ticker"] ?? "").toUpperCase();
  const isin = String(a.data["isin"] ?? "").toUpperCase();
  return CATALOG.find(
    (c) => (ticker && c.ticker.toUpperCase() === ticker) || (isin && c.isin?.toUpperCase() === isin),
  );
}

/**
 * Répartition géographique d'une ligne, en parts sommant à 1.
 * Renvoie un objet vide pour un support sans exposition actions.
 */
export function regionSplit(a: Asset): Split<Region> {
  if (a.type === "crypto") return { "Autres dév.": 1 };
  if (a.type === "av") {
    const uc = Number(a.data["ucAmount"] ?? 0);
    return uc > 0 ? normalize(REGION_WORLD) : {};
  }
  if (a.type !== "pea") return {};

  // La région explicitement saisie fait foi, sauf « Monde » qui demande
  // justement à être éclaté.
  const declared = String(a.data["region"] ?? "").trim();
  const exact = REGIONS.find((r) => r.toLowerCase() === declared.toLowerCase());
  if (exact) return { [exact]: 1 } as Split<Region>;
  if (/monde|world/i.test(declared)) return normalize(REGION_WORLD);

  const entry = catalogEntry(a);
  const text = `${textOf(a)} ${entry?.region ?? ""} ${entry?.sector ?? ""} ${entry?.name ?? ""}`;
  const hit = PATTERNS.find((p) => p.re.test(text));
  // Sans indice, on suppose une exposition mondiale : c'est le cas le
  // plus fréquent pour un ETF, et cela évite de fausser la mesure.
  return normalize(hit ? hit.region : REGION_WORLD);
}

/** Répartition sectorielle d'une ligne, en parts sommant à 1. */
export function sectorSplit(a: Asset): Split<Sector> {
  if (a.type === "crypto") return { Diversifié: 1 };
  if (a.type === "immo") return { Immobilier: 1 };
  if (a.type === "av") {
    const uc = Number(a.data["ucAmount"] ?? 0);
    return uc > 0 ? normalize(SECTOR_MSCI_WORLD) : {};
  }
  if (a.type !== "pea") return {};

  const entry = catalogEntry(a);
  const text = `${textOf(a)} ${entry?.sector ?? ""} ${entry?.region ?? ""} ${entry?.name ?? ""}`;
  const hit = PATTERNS.find((p) => p.re.test(text));
  return normalize(hit ? hit.sector : SECTOR_MSCI_WORLD);
}

/** Exposition agrégée du portefeuille, en euros, par région puis par secteur. */
export function exposure(
  assets: Asset[],
  value: (a: Asset) => number,
): { regions: Record<string, number>; sectors: Record<string, number> } {
  const regions: Record<string, number> = {};
  const sectors: Record<string, number> = {};
  for (const a of assets) {
    const v = value(a);
    if (v <= 0) continue;
    for (const [r, w] of Object.entries(regionSplit(a))) {
      regions[r] = (regions[r] ?? 0) + v * (w ?? 0);
    }
    for (const [s, w] of Object.entries(sectorSplit(a))) {
      sectors[s] = (sectors[s] ?? 0) + v * (w ?? 0);
    }
  }
  return { regions, sectors };
}
