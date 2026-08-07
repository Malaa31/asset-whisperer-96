import type { HistoryPoint } from "@/routes/api/public/history";
import type { RiskProfile } from "./types";

/**
 * Analyse des valeurs déjà détenues.
 *
 * Aucune valeur n'est ajoutée : le classement porte uniquement sur les
 * lignes du portefeuille. Trois dimensions, toutes calculées à partir
 * de l'historique mensuel ajusté (dividendes inclus) :
 *
 *  - performance lissée : rendement annualisé depuis le premier point
 *    disponible, c'est-à-dire la création du fonds quand Yahoo la couvre ;
 *  - risque : volatilité annualisée et perte maximale historique ;
 *  - signal : position du cours face à sa moyenne longue et à sa moyenne
 *    courte, plus la dynamique récente.
 *
 * Ces indicateurs décrivent le passé. Ils ne prédisent pas les
 * rendements futurs et ne constituent pas un conseil en investissement.
 */

export type SignalKind = "renforcer" | "conserver" | "alleger";

export interface Metrics {
  /** Nombre d'années couvertes par l'historique. */
  years: number;
  /** Rendement annualisé lissé depuis le début de l'historique (%). */
  cagr: number;
  /** Volatilité annualisée (%). */
  volatility: number;
  /** Perte maximale entre un sommet et le creux suivant (%). */
  maxDrawdown: number;
  /** Rendement annualisé rapporté à la volatilité. */
  riskAdjusted: number;
  /** Écart du cours à sa moyenne mobile 12 mois (%). */
  vsLongMa: number;
  /** Performance des douze derniers mois (%). */
  last12m: number;
  /** Écart au plus haut historique (%), négatif sous le sommet. */
  fromHigh: number;
}

export interface Analysis extends Metrics {
  symbol: string;
  signal: SignalKind;
  /** Score composite 0-100, pondéré par le profil de risque. */
  score: number;
  /** Justification lisible du signal. */
  reason: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Rendements mensuels successifs. */
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
  // Sous deux ans d'historique, une performance annualisée n'a pas de sens.
  if (points.length < 24) return null;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const years = (last.t - first.t) / (365.25 * 24 * 3600 * 1000);
  if (years < 1.5 || first.c <= 0) return null;

  const cagr = (Math.pow(last.c / first.c, 1 / years) - 1) * 100;

  const rets = monthlyReturns(points);
  const m = mean(rets);
  const variance = mean(rets.map((r) => (r - m) ** 2));
  const volatility = Math.sqrt(variance) * Math.sqrt(12) * 100;

  let peak = first.c;
  let maxDrawdown = 0;
  for (const p of points) {
    if (p.c > peak) peak = p.c;
    const dd = (p.c / peak - 1) * 100;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  const window = points.slice(-12);
  const longMa = mean(window.map((p) => p.c));
  const vsLongMa = longMa > 0 ? (last.c / longMa - 1) * 100 : 0;

  const twelveAgo = points[points.length - 13]?.c;
  const last12m = twelveAgo && twelveAgo > 0 ? (last.c / twelveAgo - 1) * 100 : 0;

  const high = Math.max(...points.map((p) => p.c));
  const fromHigh = high > 0 ? (last.c / high - 1) * 100 : 0;

  return {
    years,
    cagr,
    volatility,
    maxDrawdown,
    riskAdjusted: volatility > 0 ? cagr / volatility : 0,
    vsLongMa,
    last12m,
    fromHigh,
  };
}

/**
 * Signal de tendance.
 * Au-dessus de la moyenne longue et proche des sommets : la tendance
 * porte, on renforce. Nettement en dessous : on allège. Entre les deux,
 * on ne bouge pas — l'inaction est un choix valable.
 */
export function signalOf(m: Metrics): { signal: SignalKind; reason: string } {
  if (m.vsLongMa > 3 && m.last12m > 0) {
    return {
      signal: "renforcer",
      reason:
        m.fromHigh > -5
          ? "Tendance haussière, cours proche de son plus haut."
          : "Cours au-dessus de sa moyenne 12 mois, dynamique positive.",
    };
  }
  if (m.vsLongMa < -5) {
    return {
      signal: "alleger",
      reason:
        m.fromHigh < -20
          ? "Sous sa moyenne 12 mois et loin de son sommet."
          : "Cours passé sous sa moyenne 12 mois.",
    };
  }
  return { signal: "conserver", reason: "Cours proche de sa moyenne 12 mois, sans tendance nette." };
}

/**
 * Pondérations par profil : un prudent privilégie la régularité, un
 * offensif la performance brute et la dynamique.
 */
const WEIGHTS: Record<RiskProfile, { perf: number; risk: number; trend: number }> = {
  prudent: { perf: 0.2, risk: 0.6, trend: 0.2 },
  equilibre: { perf: 0.35, risk: 0.4, trend: 0.25 },
  dynamique: { perf: 0.45, risk: 0.25, trend: 0.3 },
  offensif: { perf: 0.55, risk: 0.1, trend: 0.35 },
};

/** Ramène une valeur à une échelle 0-100 entre deux bornes. */
function scale(value: number, low: number, high: number): number {
  if (high === low) return 50;
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
}

export function scoreOf(m: Metrics, profile: RiskProfile): number {
  const w = WEIGHTS[profile] ?? WEIGHTS.equilibre;
  // Bornes empiriques : 0 % à 15 %/an de performance, 5 % à 35 % de
  // volatilité, et un écart à la moyenne longue de -15 % à +15 %.
  const perf = scale(m.cagr, 0, 15);
  const risk = scale(-m.volatility, -35, -5);
  const trend = scale(m.vsLongMa, -15, 15);
  return Math.round(perf * w.perf + risk * w.risk + trend * w.trend);
}

export function analyze(
  symbol: string,
  points: HistoryPoint[],
  profile: RiskProfile,
): Analysis | null {
  const m = computeMetrics(points);
  if (!m) return null;
  const { signal, reason } = signalOf(m);
  return { ...m, symbol, signal, reason, score: scoreOf(m, profile) };
}

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  renforcer: "Renforcer",
  conserver: "Conserver",
  alleger: "Alléger",
};
