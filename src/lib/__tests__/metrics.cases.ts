import {
  annualizedReturn,
  annualizedVolatility,
  calmarRatio,
  detectFrequency,
  downsideDeviation,
  logReturns,
  maxDrawdown,
  sharpeRatio,
  sortinoRatio,
  srriBucket,
  validateMetrics,
  type Point,
} from "../metrics";

/**
 * Tests du moteur de métriques.
 * Lancer : `npx tsx src/lib/__tests__/metrics.cases.ts`
 */

const DAY = 86_400_000;
let ko = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) ko++;
};

/** Série synthétique de volatilité connue, à la fréquence demandée. */
function series(count: number, stepDays: number, sigmaPeriod: number, drift = 0): Point[] {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  // Box-Muller pour des rendements normaux.
  const pts: Point[] = [];
  let price = 100;
  const start = Date.UTC(2019, 0, 1);
  for (let i = 0; i < count; i++) {
    const u = Math.max(1e-9, rand());
    const v = rand();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    price *= Math.exp(drift + sigmaPeriod * z);
    pts.push({ t: start + i * stepDays * DAY, c: price });
  }
  return pts;
}

console.log("\nFRÉQUENCE");
check("quotidien", detectFrequency(series(60, 1, 0.01).map((p) => p.t))?.periods === 252);
check("hebdomadaire", detectFrequency(series(60, 7, 0.02).map((p) => p.t))?.periods === 52);
check("mensuel", detectFrequency(series(60, 30, 0.04).map((p) => p.t))?.periods === 12);

console.log("\nANNUALISATION");
// Une même volatilité annuelle doit ressortir quelle que soit la fréquence.
const targetAnnual = 16;
const monthly = series(72, 30, targetAnnual / 100 / Math.sqrt(12));
const weekly = series(300, 7, targetAnnual / 100 / Math.sqrt(52));
const daily = series(900, 1, targetAnnual / 100 / Math.sqrt(252));
for (const [label, pts] of [["mensuelle", monthly], ["hebdomadaire", weekly], ["quotidienne", daily]] as const) {
  const vol = annualizedVolatility(pts, 5);
  check(`série ${label} → ${vol?.toFixed(1)} %`, vol !== null && Math.abs(vol - targetAnnual) < 4);
}

console.log("\nHISTORIQUE INSUFFISANT");
check("moins d'un an renvoie null", annualizedVolatility(series(10, 30, 0.04), 3) === null);

console.log("\nCOHÉRENCE");
const bad = { volatility: 8, maxDD: -28, annualReturn: 8, sharpe: 0.71, sortino: 0.69, calmar: 0.29, srri: 2 };
const v1 = validateMetrics(bad);
check("σ 8 % avec baisse −28 % rejeté", !v1.valid, v1.warnings[0]);
const good = { volatility: 16, maxDD: -28, annualReturn: 8, sharpe: 0.375, sortino: 0.45, calmar: 0.286, srri: 6 };
check("jeu cohérent accepté", validateMetrics(good).valid);

console.log("\nSORTINO ≥ SHARPE");
const actions = series(120, 30, 0.045, 0.006);
const vol = annualizedVolatility(actions, 10)!;
const perf = annualizedReturn(actions)!;
const rets = logReturns(actions.map((p) => p.c));
const dd = downsideDeviation(rets, 0, 12);
const sh = sharpeRatio(perf, vol)!;
const so = sortinoRatio(perf, dd)!;
check(`Sharpe ${sh.toFixed(2)} ≤ Sortino ${so.toFixed(2)}`, so >= sh);

console.log("\nSRRI");
const buckets: Array<[number, number]> = [[0.3, 1], [1.5, 2], [4, 3], [8, 4], [12, 5], [16, 6], [30, 7]];
check("bornes réglementaires", buckets.every(([s, b]) => srriBucket(s) === b));
check("ETF émergent à 16 % → SRRI 6", srriBucket(16) === 6);

console.log("\nCALMAR");
const md = maxDrawdown(actions);
const cal = calmarRatio(perf, md)!;
check(`cohérent avec ses composantes`, Math.abs(cal - perf / Math.abs(md)) < 0.001);

console.log(ko ? `\n${ko} test(s) en échec` : "\nTous les tests passent");
if (ko) process.exitCode = 1;
