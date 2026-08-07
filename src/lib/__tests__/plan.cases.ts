import { buildPlanFromHoldings } from "../plan";
import type { Analysis } from "../signals";
import type { Asset, Profile } from "../types";

/**
 * Plan mensuel bâti sur les lignes détenues.
 * Lancer : `npx tsx src/lib/__tests__/plan.cases.ts`
 *
 * Vérifie trois règles : le plan ne propose que des lignes du
 * portefeuille, il écarte celles en signal Alléger, et l'épargne de
 * précaution sort du plan au-delà de dix mois de revenus.
 */

const A = (id: string, type: string, data: Record<string, unknown>) =>
  ({ id, type, data, createdAt: "", updatedAt: "" }) as unknown as Asset;
const an = (score: number, signal: string) => ({ score, signal }) as Analysis;

const assets = [
  A("w", "pea", { name: "ETF Monde", quantity: 1622, currentPrice: 6.16 }),
  A("s", "pea", { name: "S&P 500", quantity: 88, currentPrice: 58.14 }),
  A("e", "pea", { name: "Émergents", quantity: 76, currentPrice: 35.03 }),
  A("b", "pea", { name: "Stoxx 600", quantity: 168, currentPrice: 21.64 }),
  A("l", "livret", { name: "Livret A", amount: 22700 }),
  A("c", "cash", { name: "Compte courant", amount: 5628 }),
];
const analyses = new Map<string, Analysis>([
  ["w", an(78, "renforcer")], ["s", an(72, "renforcer")],
  ["e", an(45, "conserver")], ["b", an(30, "alleger")],
]);

console.log("--- Salaire 3 000 € → matelas 28 328 € = 9,4 mois (< 10) ---");
let p = buildPlanFromHoldings(assets, analyses, { incomeMonthly: 3000 } as Profile, 500);
console.log(`   matelas ${p.buffer.months?.toFixed(1)} mois, suffisant: ${p.buffer.sufficient}`);
p.lines.forEach(l => console.log(`   ${l.label.padEnd(32)} ${String(l.weight).padStart(3)}%  ${l.amount} €`));

console.log("\n--- Salaire 2 500 € → 11,3 mois (≥ 10) ---");
p = buildPlanFromHoldings(assets, analyses, { incomeMonthly: 2500 } as Profile, 500);
console.log(`   matelas ${p.buffer.months?.toFixed(1)} mois, suffisant: ${p.buffer.sufficient}`);
p.lines.forEach(l => console.log(`   ${l.label.padEnd(32)} ${String(l.weight).padStart(3)}%  ${l.amount} €`));
console.log(`   total réparti : ${p.lines.reduce((s,l)=>s+l.amount,0)} € sur 500 €`);
console.log(`   ligne en signal Alléger présente ? ${p.lines.some(l=>l.signal==="alleger")}`);

// Contrôles automatiques
const errs: string[] = [];
const sous = buildPlanFromHoldings(assets, analyses, { incomeMonthly: 3000 } as Profile, 500);
const sur = buildPlanFromHoldings(assets, analyses, { incomeMonthly: 2500 } as Profile, 500);

if (!sous.lines.some((l) => l.label.includes("précaution"))) {
  errs.push("sous 10 mois : l'épargne de précaution devrait être alimentée");
}
if (sur.lines.some((l) => l.label.includes("précaution"))) {
  errs.push("au-delà de 10 mois : l'épargne de précaution ne devrait plus figurer au plan");
}
if (sur.lines.some((l) => l.signal === "alleger")) {
  errs.push("une ligne en signal Alléger ne doit pas être renforcée");
}
const ids = new Set(assets.map((a) => a.id));
if (sur.lines.some((l) => !ids.has(l.assetId))) {
  errs.push("le plan propose une ligne absente du portefeuille");
}
if (Math.abs(sur.lines.reduce((s, l) => s + l.amount, 0) - 500) > 3) {
  errs.push("la répartition ne couvre pas le versement");
}

console.log(errs.length ? errs.map((e) => `  \u2717 ${e}`).join("\n") : "\nRègles du plan mensuel respectées");
if (errs.length) process.exitCode = 1;

// Concentration : une ligne dont la zone pèse déjà lourd doit être freinée.
const concentre = [
  A("us", "pea", { name: "S&P 500", region: "États-Unis", quantity: 100, currentPrice: 100 }),
  A("eu", "pea", { name: "Stoxx 600", region: "Europe", quantity: 10, currentPrice: 100 }),
] as Asset[];
const memeScore = new Map<string, Analysis>([
  ["us", an(70, "renforcer")],
  ["eu", an(70, "renforcer")],
]);
const pc = buildPlanFromHoldings(concentre, memeScore, { incomeMonthly: 5000 } as Profile, 500);
const us = pc.lines.find((l) => l.assetId === "us");
const eu = pc.lines.find((l) => l.assetId === "eu");
if (!us?.concentrationNote) {
  console.log("  \u2717 la ligne surpondérée n'est pas signalée");
  process.exitCode = 1;
} else if ((us.amount ?? 0) >= (eu?.amount ?? 0)) {
  console.log("  \u2717 à score égal, la ligne concentrée devrait recevoir moins");
  process.exitCode = 1;
} else {
  console.log(`Concentration prise en compte : ${us.amount} € vs ${eu?.amount} € à score égal`);
}
