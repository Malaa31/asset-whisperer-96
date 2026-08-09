import type { HistoryPoint } from "@/routes/api/public/history";
import {
  annualizedReturn,
  annualizedVolatility,
  calmarRatio,
  detectFrequency,
  downsideDeviation,
  logReturns,
  jensenAlpha,
  maxDrawdown,
  sharpeRatio,
  sortinoRatio,
  srriBucket,
  validateMetrics,
  windowOf,
  compositeSignal,
  type CompositeSignal,
  type Regression,
} from "./metrics";
import type { RiskProfile } from "./types";

/**
 * Analyse d'une ligne cotée à partir de son historique.
 *
 * On juge le rendement au regard du risque pris, pas la seule hausse :
 * un actif qui a gagné 10 %/an en subissant une chute de 60 % a moins
 * bien travaillé qu'un autre à 7 %/an sans à-coups. Quand un marché de
 * référence est disponible, l'alpha tranche : il isole ce que la ligne
 * a rapporté au-delà de son exposition au marché — monter dans un
 * marché qui monte n'est pas une performance.
 *
 * Ces indicateurs décrivent le passé. Ils ne prédisent rien.
 */

/** Deux ans de cotation minimum, sinon la mesure n'a pas de sens. */
const MIN_YEARS = 2;
/** Rémunération d'un placement sans risque, en points de pourcentage. */
const RISK_FREE = 2;

export type SignalKind = "renforcer" | "conserver" | "alleger";
export type Verdict = "excellent" | "correct" | "moyen" | "decevant";

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  renforcer: "Renforcer",
  conserver: "Conserver",
  alleger: "Alléger",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  excellent: "Très bon placement",
  correct: "Bon placement",
  moyen: "Placement moyen",
  decevant: "Placement décevant",
};

export interface Metrics {
  years: number;
  /** Performance annualisée depuis le début de l'historique (%). */
  cagr: number;
  /** Volatilité annualisée (%). */
  volatility: number;
  /** Pire baisse entre un sommet et le creux suivant (%, négatif). */
  maxDrawdown: number;
  /** Écart du cours à sa moyenne 12 mois (%). */
  vsLongMa: number;
  /** Performance des douze derniers mois (%). */
  last12m: number;
  /** Rendement excédentaire rapporté à la volatilité totale. */
  sharpe: number;
  /** Idem, rapporté à la seule volatilité baissière. */
  sortino: number;
  /** Performance annualisée rapportée à la pire baisse. */
  calmar: number;
  /** Sensibilité au marché de référence (1 = suit l'indice). */
  beta?: number;
  /** Surperformance annualisée à risque de marché égal (%). */
  alpha?: number;
  /** Échelle de risque réglementaire, de 1 à 7. */
  srri: number;
  /** Fréquence détectée des données, en périodes par an. */
  periods: number;
  /** Les métriques passent-elles les contrôles de cohérence ? */
  consistent: boolean;
  warnings: string[];
}

export interface Analysis extends Metrics {
  symbol: string;
  signal: SignalKind;
  reason: string;
  verdict: Verdict;
  verdictReason: string;
  /** Score de classement 0-100, pondéré par le profil. */
  score: number;
  /** Détail du signal composite, pour l'affichage des sous-scores. */
  composite?: CompositeSignal;
  /** Comparaison à l'indice de référence. */
  regression?: Regression;
}

const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

function monthlyReturns(points: HistoryPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!.c;
    const cur = points[i]!.c;
    if (prev > 0) out.push(cur / prev - 1);
  }
  return out;
}

export function computeMetrics(points: HistoryPoint[]): Metrics | null {
  return computeMetricsV2(points);
}


/**
 * Régression des rendements de la ligne sur ceux du marché de référence.
 * Le bêta mesure la sensibilité au marché, l'alpha ce que la ligne a
 * rapporté au-delà de ce que cette exposition expliquait.
 */
export function regress(
  points: HistoryPoint[],
  benchmark: HistoryPoint[],
): { beta: number; alpha: number } | null {
  const bRets = monthlyReturns(benchmark);
  const byMonth = new Map<string, number>();
  benchmark.slice(1).forEach((p, i) => {
    byMonth.set(new Date(p.t).toISOString().slice(0, 7), bRets[i] ?? 0);
  });

  const xs: number[] = [];
  const ys: number[] = [];
  const aRets = monthlyReturns(points);
  points.slice(1).forEach((p, i) => {
    const b = byMonth.get(new Date(p.t).toISOString().slice(0, 7));
    if (b !== undefined) {
      xs.push(b);
      ys.push(aRets[i] ?? 0);
    }
  });
  if (xs.length < 24) return null;

  const mx = mean(xs);
  const my = mean(ys);
  const cov = mean(xs.map((x, i) => (x - mx) * ((ys[i] ?? 0) - my)));
  const varx = mean(xs.map((x) => (x - mx) ** 2));
  if (varx <= 0) return null;

  const beta = cov / varx;
  return { beta, alpha: (my - beta * mx) * 12 * 100 };
}

/** Phrase résumant ce qui pousse le signal, à partir du sous-score dominant. */
function reasonOf(c: CompositeSignal): string {
  const top = [...c.parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  if (!top || Math.abs(top.value) < 0.1) {
    return "Aucun facteur ne ressort nettement : la ligne se tient dans sa moyenne.";
  }
  const sens = top.value > 0 ? "favorable" : "défavorable";
  return `${top.label} ${sens} : c'est ce qui pèse le plus dans le signal.`;
}

function signalOf(m: Metrics): { signal: SignalKind; reason: string } {
  if (m.vsLongMa < -8 || m.last12m < -18) {
    return {
      signal: "alleger",
      reason: `Cours ${m.vsLongMa.toFixed(0)} % sous sa moyenne 12 mois, tendance baissière.`,
    };
  }
  if (m.vsLongMa > 4 && m.last12m > 0) {
    return { signal: "renforcer", reason: "Tendance haussière, cours au-dessus de sa moyenne 12 mois." };
  }
  return { signal: "conserver", reason: "Cours proche de sa moyenne 12 mois, sans tendance nette." };
}

export function verdictOf(m: Metrics): { verdict: Verdict; reason: string } {
  if (m.alpha !== undefined) {
    if (m.alpha > 2) {
      return {
        verdict: "excellent",
        reason: `${m.alpha.toFixed(1)} %/an au-delà de ce que son exposition au marché explique.`,
      };
    }
    if (m.alpha < -2) {
      return {
        verdict: "decevant",
        reason: `${m.alpha.toFixed(1)} %/an sous ce que son exposition au marché aurait dû rapporter.`,
      };
    }
  }
  if (m.sharpe >= 0.7 && m.calmar >= 0.4) {
    return {
      verdict: "excellent",
      reason: `${m.cagr.toFixed(1)} %/an pour ${m.volatility.toFixed(0)} % de volatilité : rapport rendement/risque solide.`,
    };
  }
  if (m.sharpe >= 0.4) {
    return { verdict: "correct", reason: `${m.cagr.toFixed(1)} %/an, le risque pris est correctement rémunéré.` };
  }
  if (m.sharpe >= 0.15) {
    return {
      verdict: "moyen",
      reason: `${m.cagr.toFixed(1)} %/an pour ${m.volatility.toFixed(0)} % de volatilité : le risque est peu rémunéré.`,
    };
  }
  return {
    verdict: "decevant",
    reason:
      m.cagr < 2
        ? `${m.cagr.toFixed(1)} %/an : à peine mieux qu'un placement sans risque.`
        : `Le risque pris (pire baisse ${m.maxDrawdown.toFixed(0)} %) n'est pas rémunéré.`,
  };
}

/** Pondérations du score selon le profil. */
const WEIGHTS: Record<RiskProfile, { perf: number; risk: number; trend: number }> = {
  prudent: { perf: 0.2, risk: 0.6, trend: 0.2 },
  equilibre: { perf: 0.35, risk: 0.4, trend: 0.25 },
  dynamique: { perf: 0.45, risk: 0.25, trend: 0.3 },
  offensif: { perf: 0.55, risk: 0.1, trend: 0.35 },
};

const scale = (v: number, min: number, max: number): number =>
  Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

function scoreOf(m: Metrics, profile: RiskProfile): number {
  const w = WEIGHTS[profile] ?? WEIGHTS.equilibre;
  // La performance se juge en brut et à risque égal. Le dosage suit le
  // profil : un prudent regarde surtout le rendement rapporté au risque,
  // un offensif la performance brute.
  const sharpeShare = w.risk;
  const perf =
    scale(m.cagr, 0, 15) * (1 - sharpeShare) + scale(m.sharpe, 0, 1.2) * sharpeShare;
  const risk = (scale(-m.volatility, -35, -5) + scale(-m.maxDrawdown, -55, -5)) / 2;
  const trend = scale(m.vsLongMa, -15, 15);
  return Math.round(perf * w.perf + risk * w.risk + trend * w.trend);
}

/**
 * Métriques calculées par le module dédié, avec contrôle de cohérence.
 * Les fenêtres retenues suivent l'usage : trois ans pour la volatilité
 * et les ratios, la totalité de l'historique pour la pire baisse.
 */
function computeMetricsV2(points: HistoryPoint[]): Metrics | null {
  const pts = points.filter((p) => p.c > 0).sort((a, b) => a.t - b.t);
  if (pts.length < 12) return null;

  const years = (pts[pts.length - 1]!.t - pts[0]!.t) / (365.25 * 24 * 3600 * 1000);
  if (years < MIN_YEARS) return null;

  const volatility = annualizedVolatility(pts, 3);
  if (volatility === null) return null;

  const win = windowOf(pts, 3);
  const freq = detectFrequency(win.map((p) => p.t));
  const periods = freq?.periods ?? 12;
  const rets = logReturns(win.map((p) => p.c));

  const cagr = annualizedReturn(pts) ?? 0;
  const maxDD = maxDrawdown(pts);
  const sharpe = sharpeRatio(cagr, volatility) ?? 0;
  const sortino = sortinoRatio(cagr, downsideDeviation(rets, 0, periods)) ?? sharpe;
  const calmar = calmarRatio(cagr, maxDD) ?? 0;

  // Moyenne longue et dynamique récente, exprimées sur la fréquence réelle.
  const longWindow = Math.max(6, Math.round(periods));
  const tail = pts.slice(-longWindow);
  const ma = tail.reduce((s, p) => s + p.c, 0) / tail.length;
  const last = pts[pts.length - 1]!.c;
  const vsLongMa = ma > 0 ? (last / ma - 1) * 100 : 0;
  const ref = pts[Math.max(0, pts.length - longWindow - 1)]!;
  const last12m = ref.c > 0 ? (last / ref.c - 1) * 100 : 0;

  const bundle = { volatility, maxDD, annualReturn: cagr, sharpe, sortino, calmar, srri: null };
  const { valid, warnings } = validateMetrics(bundle);

  return {
    years,
    cagr,
    volatility,
    maxDrawdown: maxDD,
    vsLongMa,
    last12m,
    sharpe,
    sortino,
    calmar,
    srri: srriBucket(volatility),
    periods,
    consistent: valid,
    warnings,
  };
}

export function analyze(
  symbol: string,
  points: HistoryPoint[],
  profile: RiskProfile,
  benchmark?: HistoryPoint[],
): Analysis | null {
  const base = computeMetrics(points);
  if (!base) return null;

  const freq = detectFrequency(points.map((p) => p.t));
  const reg = benchmark?.length
    ? jensenAlpha(monthlyReturns(points), monthlyReturns(benchmark), freq?.periods ?? 12)
    : null;
  const m: Metrics = reg ? { ...base, beta: reg.beta, alpha: reg.alpha } : base;

  // Le signal composite croise tendance de fond, surperformance et excès
  // de court terme. La seule moyenne 12 mois, trop fruste, ne sert plus
  // que de repli quand l'historique est trop court.
  const composite = compositeSignal(points, benchmark ? monthlyReturns(benchmark) : undefined);
  const fallback = signalOf(m);
  const signal: SignalKind = composite
    ? composite.kind === "achat"
      ? "renforcer"
      : composite.kind
    : fallback.signal;
  const reason = composite ? reasonOf(composite) : fallback.reason;
  const { verdict, reason: verdictReason } = verdictOf(m);
  return {
    ...m,
    symbol,
    signal,
    reason,
    verdict,
    verdictReason,
    score: scoreOf(m, profile),
    ...(composite ? { composite } : {}),
    ...(reg ? { regression: reg } : {}),
  };
}
