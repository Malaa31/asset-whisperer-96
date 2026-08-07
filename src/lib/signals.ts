import type { HistoryPoint } from "@/routes/api/public/history";
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
}

export interface Analysis extends Metrics {
  symbol: string;
  signal: SignalKind;
  reason: string;
  verdict: Verdict;
  verdictReason: string;
  /** Score de classement 0-100, pondéré par le profil. */
  score: number;
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
  const pts = points.filter((p) => p.c > 0).sort((a, b) => a.t - b.t);
  if (pts.length < MIN_YEARS * 12) return null;

  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const years = (last.t - first.t) / (365.25 * 24 * 3600 * 1000);
  if (years < MIN_YEARS) return null;

  const cagr = (Math.pow(last.c / first.c, 1 / years) - 1) * 100;

  const rets = monthlyReturns(pts);
  const m = mean(rets);
  const variance = mean(rets.map((r) => (r - m) ** 2));
  const volatility = Math.sqrt(variance) * Math.sqrt(12) * 100;

  // Pire baisse : plus grand recul entre un sommet et le creux suivant.
  let peak = pts[0]!.c;
  let maxDrawdown = 0;
  for (const p of pts) {
    if (p.c > peak) peak = p.c;
    const dd = (p.c / peak - 1) * 100;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  const window = pts.slice(-12);
  const ma = mean(window.map((p) => p.c));
  const vsLongMa = ma > 0 ? (last.c / ma - 1) * 100 : 0;

  const ref12 = pts[Math.max(0, pts.length - 13)]!;
  const last12m = ref12.c > 0 ? (last.c / ref12.c - 1) * 100 : 0;

  const excess = cagr - RISK_FREE;
  const sharpe = volatility > 0 ? excess / volatility : 0;

  // Volatilité baissière seule : un actif qui ne bouge qu'à la hausse
  // n'est pas risqué, l'écart-type classique le pénalise à tort.
  const down = rets.filter((r) => r < 0);
  const downDev = down.length ? Math.sqrt(mean(down.map((r) => r ** 2))) * Math.sqrt(12) * 100 : 0;
  const sortino = downDev > 0 ? excess / downDev : sharpe;

  const calmar = maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : 0;

  return { years, cagr, volatility, maxDrawdown, vsLongMa, last12m, sharpe, sortino, calmar };
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

export function analyze(
  symbol: string,
  points: HistoryPoint[],
  profile: RiskProfile,
  benchmark?: HistoryPoint[],
): Analysis | null {
  const base = computeMetrics(points);
  if (!base) return null;

  const reg = benchmark?.length ? regress(points, benchmark) : null;
  const m: Metrics = reg ? { ...base, beta: reg.beta, alpha: reg.alpha } : base;

  const { signal, reason } = signalOf(m);
  const { verdict, reason: verdictReason } = verdictOf(m);
  return { ...m, symbol, signal, reason, verdict, verdictReason, score: scoreOf(m, profile) };
}
