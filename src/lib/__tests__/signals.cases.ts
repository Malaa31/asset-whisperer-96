import { analyze, computeMetrics } from "../signals";

/**
 * Comportement des indicateurs sur des scénarios typés.
 * Lancer : `npx tsx src/lib/__tests__/signals.cases.ts`
 *
 * On vérifie deux propriétés :
 *  - le signal correspond à la tendance (haussier → renforcer, baissier → alléger) ;
 *  - le score se différencie selon le profil (une ligne volatile monte
 *    chez l'offensif et descend chez le prudent).
 */

// Séries synthétiques : 60 mois, comportements typés
function serie(start: number, monthly: number, noise: number, seed = 1) {
  let s = seed, c = start;
  const pts = [];
  for (let i = 0; i < 60; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const r = ((s / 2147483648) - 0.5) * noise;
    c = c * (1 + monthly + r);
    pts.push({ t: Date.UTC(2020, i, 1), c });
  }
  return pts;
}
const cas: Array<[string, ReturnType<typeof serie>]> = [
  ["Haussier régulier (ETF Monde)", serie(100, 0.008, 0.03)],
  ["Volatil mais performant", serie(100, 0.012, 0.14)],
  ["Baissier récent", (() => {
    const a = serie(100, 0.01, 0.03).slice(0, 45);
    const b = serie(a[44]!.c, -0.02, 0.04).slice(0, 15)
      .map((p, i) => ({ t: Date.UTC(2023, 9 + i, 1), c: p.c }));
    return [...a, ...b];
  })()],
  ["Stagnant", serie(100, 0.0005, 0.02)],
];
for (const [nom, pts] of cas) {
  const m = computeMetrics(pts);
  if (!m) { console.log(`\n${nom}\n  historique insuffisant`); continue; }
  console.log(`\n${nom}`);
  console.log(`  perf/an ${m.cagr.toFixed(1)}% · volatilité ${m.volatility.toFixed(1)}% · pire baisse ${m.maxDrawdown.toFixed(1)}%`);
  console.log(`  vs moyenne 12m ${m.vsLongMa.toFixed(1)}% · 12 derniers mois ${m.last12m.toFixed(1)}%`);
  for (const p of ["prudent","equilibre","dynamique","offensif"] as const) {
    const a = analyze("X", pts, p)!;
    process.stdout.write(`  ${p.padEnd(10)} score ${String(a.score).padStart(3)} → ${a.signal}\n`);
  }
}

// Contrôles automatiques
const haussier = serie(100, 0.008, 0.03);
const baissier = (() => {
  const a = serie(100, 0.01, 0.03).slice(0, 45);
  const b = serie(a[44]!.c, -0.02, 0.04)
    .slice(0, 15)
    .map((p, i) => ({ t: Date.UTC(2023, 9 + i, 1), c: p.c }));
  return [...a, ...b];
})();
const volatil = serie(100, 0.012, 0.14);
const calme = serie(100, 0.006, 0.02);

const errs: string[] = [];
if (analyze("H", haussier, "equilibre")!.signal !== "renforcer") errs.push("haussier ≠ renforcer");
if (analyze("B", baissier, "equilibre")!.signal !== "alleger") errs.push("baissier ≠ alleger");
// Le profil doit changer l'ordre : le prudent préfère la ligne calme,
// l'offensif la ligne performante mais volatile.
const prudentPrefereCalme =
  analyze("C", calme, "prudent")!.score > analyze("V", volatil, "prudent")!.score;
const offensifPrefereVolatil =
  analyze("V", volatil, "offensif")!.score > analyze("C", calme, "offensif")!.score;
if (!prudentPrefereCalme) errs.push("le profil prudent ne privilégie pas la régularité");
if (!offensifPrefereVolatil) errs.push("le profil offensif ne privilégie pas la performance");

console.log(errs.length ? errs.map((e) => `  \u2717 ${e}`).join("\n") : "\nSignaux et pondérations par profil cohérents");
if (errs.length) process.exitCode = 1;
