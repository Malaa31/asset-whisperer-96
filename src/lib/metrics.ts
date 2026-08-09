/**
 * Métriques de risque et de performance.
 *
 * Fonctions pures, sans dépendance à l'interface, pour être testables
 * isolément. Le principe directeur : ne jamais présumer de la fréquence
 * des données reçues. Une série hebdomadaire annualisée comme si elle
 * était mensuelle divise la volatilité par deux, ce qui rend le Sharpe
 * flatteur et le niveau de risque trompeur.
 */

export interface Point {
  /** Horodatage en millisecondes. */
  t: number;
  /** Cours de clôture ajusté. */
  c: number;
}

export type Frequency = "daily" | "weekly" | "monthly";

export interface FrequencyInfo {
  /** Nombre de périodes par an, facteur d'annualisation. */
  periods: number;
  label: Frequency;
}

/** Médiane d'une série, sans la modifier. */
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : ((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Déduit la fréquence d'échantillonnage de l'écart médian entre points.
 * La médiane, et non la moyenne, pour ne pas être faussée par les
 * périodes de fermeture des marchés.
 */
export function detectFrequency(dates: number[]): FrequencyInfo | null {
  if (dates.length < 3) return null;
  const gaps = dates.slice(1).map((d, i) => (d - dates[i]!) / 86_400_000);
  const gap = median(gaps.filter((g) => g > 0));
  if (gap <= 0) return null;
  if (gap <= 4) return { periods: 252, label: "daily" };
  if (gap <= 10) return { periods: 52, label: "weekly" };
  if (gap <= 40) return { periods: 12, label: "monthly" };
  return null;
}

/** Rendements logarithmiques successifs. */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1]!;
    const b = prices[i]!;
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

/** Écart-type échantillonnal : diviseur n − 1, pas n. */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Ne conserve que les points des `years` dernières années. */
export function windowOf(points: Point[], years: number): Point[] {
  if (!points.length) return [];
  const last = points[points.length - 1]!.t;
  const from = last - years * 365.25 * 86_400_000;
  return points.filter((p) => p.t >= from);
}

/**
 * Volatilité annualisée, en pourcentage.
 * Renvoie null si l'historique couvre moins d'un an : un chiffre calculé
 * sur trop peu de points induit en erreur plus qu'il n'informe.
 */
export function annualizedVolatility(points: Point[], years = 3): number | null {
  const win = windowOf(points, years);
  const freq = detectFrequency(win.map((p) => p.t));
  if (!freq) return null;

  const span = (win[win.length - 1]!.t - win[0]!.t) / (365.25 * 86_400_000);
  if (span < 1) return null;

  const rets = logReturns(win.map((p) => p.c));
  if (rets.length < 8) return null;
  return stdDev(rets) * Math.sqrt(freq.periods) * 100;
}

/** Pire baisse entre un sommet et le creux suivant, en pourcentage négatif. */
export function maxDrawdown(points: Point[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const p of points) {
    if (p.c > peak) peak = p.c;
    if (peak > 0) {
      const dd = (p.c / peak - 1) * 100;
      if (dd < worst) worst = dd;
    }
  }
  return worst;
}

/** Performance annualisée sur la fenêtre, en pourcentage. */
export function annualizedReturn(points: Point[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const years = (last.t - first.t) / (365.25 * 86_400_000);
  if (years < 1 || first.c <= 0) return null;
  return (Math.pow(last.c / first.c, 1 / years) - 1) * 100;
}

/** Rendement excédentaire rapporté à la volatilité totale. */
export function sharpeRatio(annualReturn: number, volatility: number, rf = 2): number | null {
  if (volatility <= 0) return null;
  return (annualReturn - rf) / volatility;
}

/**
 * Déviation à la baisse, annualisée et en pourcentage.
 *
 * Le carré des écarts négatifs est divisé par le nombre **total**
 * d'observations, pas seulement les négatives. Diviser par les seules
 * baisses gonfle la déviation et fait passer le Sortino sous le Sharpe,
 * ce qui est impossible par construction.
 */
export function downsideDeviation(returns: number[], mar = 0, periods = 12): number {
  if (!returns.length) return 0;
  const sum = returns.reduce((s, r) => s + Math.min(r - mar, 0) ** 2, 0);
  return Math.sqrt(sum / returns.length) * Math.sqrt(periods) * 100;
}

export function sortinoRatio(
  annualReturn: number,
  downsideDev: number,
  rf = 2,
): number | null {
  if (downsideDev <= 0) return null;
  return (annualReturn - rf) / downsideDev;
}

/** Performance annualisée rapportée à la pire baisse subie. */
export function calmarRatio(annualReturn: number, maxDD: number): number | null {
  if (maxDD >= 0) return null;
  return annualReturn / Math.abs(maxDD);
}

/**
 * Échelle de risque réglementaire européenne, de 1 à 7, fondée sur la
 * volatilité annualisée calculée en rendements hebdomadaires sur cinq
 * ans. Bornes officielles du référentiel CESR/10-673.
 */
export const SRRI_LABELS = [
  "",
  "Très faible",
  "Faible",
  "Modéré",
  "Moyen",
  "Moyen-élevé",
  "Élevé",
  "Très élevé",
] as const;

export function srriBucket(sigma: number): number {
  if (sigma < 0.5) return 1;
  if (sigma < 2) return 2;
  if (sigma < 5) return 3;
  if (sigma < 10) return 4;
  if (sigma < 15) return 5;
  if (sigma < 25) return 6;
  return 7;
}

/** Bornes de plausibilité de la volatilité, par nature de support. */
const PLAUSIBLE: Record<string, [number, number]> = {
  "actions-dev": [10, 25],
  "actions-em": [13, 28],
  obligataire: [2, 10],
  monetaire: [0, 2],
};

export interface MetricsBundle {
  volatility: number | null;
  maxDD: number;
  annualReturn: number | null;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  srri: number | null;
}

export interface Validation {
  valid: boolean;
  warnings: string[];
}

/**
 * Contrôles de cohérence interne.
 *
 * Le premier est le plus important : une volatilité inférieure au tiers
 * de la pire baisse est mathématiquement suspecte — un actif à 8 % de
 * volatilité ne subit pas une chute de 28 %, qui serait un événement à
 * plus de trois écarts-types.
 */
export function validateMetrics(m: MetricsBundle, kind?: string): Validation {
  const warnings: string[] = [];

  if (m.volatility !== null && m.maxDD < 0 && m.volatility <= Math.abs(m.maxDD) / 3.5) {
    warnings.push(
      `Volatilité de ${m.volatility.toFixed(1)} % incompatible avec une baisse de ${m.maxDD.toFixed(0)} %`,
    );
  }
  if (m.sortino !== null && m.sharpe !== null && m.sortino < m.sharpe - 0.001) {
    warnings.push("Sortino inférieur au Sharpe, ce qui est impossible par construction");
  }
  if (m.calmar !== null && m.annualReturn !== null && m.maxDD < 0) {
    const expected = m.annualReturn / Math.abs(m.maxDD);
    if (Math.abs(expected - m.calmar) > 0.02) warnings.push("Calmar incohérent avec ses composantes");
  }
  const bounds = kind ? PLAUSIBLE[kind] : undefined;
  if (bounds && m.volatility !== null && (m.volatility < bounds[0] || m.volatility > bounds[1])) {
    warnings.push(
      `Volatilité hors des bornes attendues pour ce type de support (${bounds[0]}–${bounds[1]} %)`,
    );
  }

  // Seule l'incohérence entre volatilité et baisse invalide l'affichage :
  // les autres avertissements informent sans masquer les chiffres.
  const blocking = warnings.some((w) => w.startsWith("Volatilité de"));
  return { valid: !blocking, warnings };
}

/** Régression des rendements sur ceux d'un indice de référence. */
/** Résultat de la régression d'un actif sur son indice de référence. */
export interface Regression {
  /** Alpha de Jensen annualisé, en pourcentage. */
  alpha: number;
  /** Sensibilité au marché : 1 signifie suivre l'indice. */
  beta: number;
  /** Écart-type annualisé de la différence de rendement, en pourcentage. */
  trackingError: number;
  /** Part de la variance expliquée par l'indice. */
  r2: number;
}

export function jensenAlpha(
  assetReturns: number[],
  benchmarkReturns: number[],
  periods = 12,
  rf = 2,
): Regression | null {
  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  if (n < 24) return null;
  const a = assetReturns.slice(-n);
  const b = benchmarkReturns.slice(-n);

  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(a);
  const mb = mean(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i]! - mb), 0) / (n - 1);
  const varB = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (n - 1);
  if (varB <= 0) return null;

  const beta = cov / varB;
  const rfPeriod = rf / 100 / periods;
  // Alpha de Jensen : ce que l'actif rapporte au-delà de ce que son
  // exposition au marché explique.
  const alpha = (ma - rfPeriod - beta * (mb - rfPeriod)) * periods * 100;

  const diffs = a.map((x, i) => x - b[i]!);
  const trackingError = stdDev(diffs) * Math.sqrt(periods) * 100;

  const varA = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (n - 1);
  const r2 = varA > 0 ? (cov * cov) / (varA * varB) : 0;

  return { alpha, beta, trackingError, r2 };
}

/** Indice de force relative sur `n` périodes, entre 0 et 100. */
export function rsi(prices: number[], n = 14): number | null {
  if (prices.length < n + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - n; i < prices.length; i++) {
    const change = prices[i]! - prices[i - 1]!;
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (gains + losses === 0) return 50;
  const rs = losses === 0 ? Infinity : gains / n / (losses / n);
  return 100 - 100 / (1 + rs);
}

export type SignalKind = "achat" | "conserver" | "alleger";

export interface CompositeSignal {
  score: number;
  kind: SignalKind;
  parts: Array<{ key: string; label: string; value: number }>;
}

/**
 * Score composite de tendance, entre −1 et +1.
 *
 * La valorisation, qui supposerait un historique de multiples de
 * résultats indisponible pour un fonds indiciel, est écartée et son
 * poids redistribué sur les trois autres composantes.
 */
export function compositeSignal(
  points: Point[],
  benchmarkReturns?: number[],
): CompositeSignal | null {
  if (points.length < 30) return null;
  const prices = points.map((p) => p.c);
  const last = prices[prices.length - 1]!;

  const freq = detectFrequency(points.map((p) => p.t));
  const periods = freq?.periods ?? 12;
  // Moyenne longue : deux cents séances, soit environ dix mois.
  const window = Math.max(10, Math.round((200 / 252) * periods));
  const recent = prices.slice(-window);
  const ma = recent.reduce((s, x) => s + x, 0) / recent.length;

  const momentum = Math.tanh((last / ma - 1) * 5);

  const rsiValue = rsi(prices, 14);
  const rsiScore = rsiValue === null ? 0 : Math.max(-1, Math.min(1, (50 - rsiValue) / 50));

  const rets = logReturns(prices);
  const reg = benchmarkReturns ? jensenAlpha(rets, benchmarkReturns, periods) : null;
  const alphaScore = reg ? Math.tanh((reg.alpha / 100) * 20) : 0;

  // Poids d'origine 0,30 / 0,25 / 0,15 renormalisés sur 0,70.
  const score = (0.3 * momentum + 0.25 * alphaScore + 0.15 * rsiScore) / 0.7;
  const kind: SignalKind = score > 0.35 ? "achat" : score < -0.15 ? "alleger" : "conserver";

  return {
    score,
    kind,
    parts: [
      { key: "momentum", label: "Tendance de fond", value: momentum },
      { key: "alpha", label: "Surperformance", value: alphaScore },
      { key: "rsi", label: "Excès court terme", value: rsiScore },
    ],
  };
}
