import {
  aggregateExposures,
  classifyPocket,
  concentrationIndex,
  defensiveGap,
  isFinancial,
  overlap,
  planLabel,
  realExposure,
  goalInsight,
  herfindahl,
  intentFromSignal,
  optimizePlan,
  riskBudgetFromProfile,
  targetAllocation,
} from "../monthly-plan";
import type { Analysis } from "../signals";
import type { Asset, Goal, Profile } from "../types";

/** Fabrique une ligne de portefeuille. */
const A = (id: string, name: string, value: number, ticker = ""): Asset =>
  ({
    id,
    type: "pea",
    data: { name, ticker, quantity: 1, currentPrice: value, pru: value },
    createdAt: "",
    updatedAt: "",
  }) as unknown as Asset;

/** Fabrique une analyse. */
const An = (over: Partial<Analysis>): Analysis =>
  ({
    volatility: 15,
    maxDrawdown: -25,
    srri: 5,
    score: 60,
    signal: "conserver",
    composite: { score: 0, kind: "conserver", parts: [] },
    ...over,
  }) as unknown as Analysis;

const P = (over: Partial<Profile>): Profile =>
  ({ riskProfile: "equilibre", incomeMonthly: 3000, ...over }) as unknown as Profile;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log("\nBUDGET DE RISQUE");
{
  const sansAge = riskBudgetFromProfile(P({ riskProfile: "dynamique" }));
  check("sans âge, aucune modulation", sansAge.sigmaTarget === 13 && sansAge.horizon === undefined);
  const avecAge = riskBudgetFromProfile(P({ riskProfile: "dynamique", age: 35 }));
  check(
    "avec âge, horizon appliqué",
    avecAge.horizon === 30 && avecAge.sigmaTarget > 13,
    `σ ${avecAge.sigmaTarget.toFixed(1)} %`,
  );
}

console.log("\nRENDEMENT REQUIS");
{
  const budget = riskBudgetFromProfile(P({}));
  check(
    "âge et horizon absents → aucun chiffre",
    goalInsight(100_000, { amount: 200_000 } as Goal, budget).requiredReturn === undefined,
  );
  const atteint = goalInsight(250_000, { amount: 200_000, horizon: 10 } as Goal, budget);
  check(
    "objectif déjà couvert → message, pas de pourcentage négatif",
    atteint.kind === "reached" && atteint.requiredReturn === undefined,
  );
  const normal = goalInsight(100_000, { amount: 200_000, horizon: 10 } as Goal, budget);
  check(
    "cas normal → rendement positif",
    normal.kind === "ok" && (normal.requiredReturn ?? 0) > 0,
    `${normal.requiredReturn?.toFixed(1)} %/an`,
  );
  const fou = goalInsight(10_000, { amount: 500_000, horizon: 5 } as Goal, budget);
  check("objectif hors d'atteinte signalé", fou.kind === "unrealistic");
}

console.log("\nEXPOSITIONS EN TRANSPARENCE");
{
  const portfolio = [A("w", "ETF MSCI World", 10_000), A("s", "ETF S&P 500", 10_000)];
  const exp = aggregateExposures(portfolio);
  const us = exp.byZone["États-Unis"] ?? 0;
  check(
    "World + S&P 500 révèle la concentration américaine",
    us > 0.8,
    `${(us * 100).toFixed(0)} % États-Unis`,
  );
  check("Europe présente via le World", (exp.byZone["Europe"] ?? 0) > 0.05);
}

console.log("\nPROFIL PRUDENT FACE À DES SUPPORTS RISQUÉS");
{
  const portfolio = [A("a", "ETF Émergent", 5_000), A("b", "ETF Nasdaq", 5_000)];
  const analyses = new Map<string, Analysis>([
    ["a", An({ srri: 6, volatility: 20 })],
    ["b", An({ srri: 6, volatility: 22 })],
  ]);
  const out = optimizePlan(portfolio, analyses, P({ riskProfile: "prudent" }), 500);
  const risky = out.lines
    .filter((l) => (analyses.get(l.assetId)?.srri ?? 0) >= 6)
    .reduce((s, l) => s + l.amount, 0);
  check("rien n'est alloué aux supports les plus risqués", risky === 0, `${risky} €`);
  check(
    "le problème est signalé",
    out.violations.some((v) => v.code === "srri_cap"),
  );
}

console.log("\nCOHÉRENCE AVEC LE SIGNAL");
{
  check("score 0,10 → maintien, jamais renforcement", intentFromSignal(0.1) === "maintenir");
  check("score 0,50 → renforcement", intentFromSignal(0.5) === "renforcer");
  check("score −0,40 → allègement", intentFromSignal(-0.4) === "alleger");

  const portfolio = [A("a", "ETF Monde", 10_000), A("b", "ETF Europe", 5_000)];
  const analyses = new Map<string, Analysis>([
    ["a", An({ composite: { score: 0.1, kind: "conserver", parts: [] } as never })],
    ["b", An({ composite: { score: 0.1, kind: "conserver", parts: [] } as never })],
  ]);
  const out = optimizePlan(portfolio, analyses, P({}), 500);
  check(
    "aucune ligne à 0,10 n'est libellée renforcer",
    out.lines.every((l) => l.intent !== "renforcer"),
  );
}

console.log("\nTRAÇABILITÉ DES MONTANTS");
{
  let bad = 0;
  for (let i = 0; i < 20; i++) {
    const n = 2 + (i % 4);
    const portfolio = Array.from({ length: n }, (_, k) =>
      A(`x${k}`, ["ETF Monde", "ETF S&P 500", "ETF Europe", "ETF Émergent", "ETF Japon"][k]!, 1_000 * (k + 1)),
    );
    const analyses = new Map<string, Analysis>(
      portfolio.map((a, k) => [
        a.id,
        An({
          volatility: 12 + k * 2,
          srri: 4 + (k % 3),
          composite: { score: -0.3 + k * 0.2, kind: "conserver", parts: [] } as never,
        }),
      ]),
    );
    const dca = 300 + i * 37;
    const out = optimizePlan(portfolio, analyses, P({ riskProfile: "dynamique" }), dca);
    for (const l of out.lines) {
      const b = l.breakdown;
      if (b.convergence + b.signal + b.risk + b.rounding !== l.amount) bad++;
    }
    const total = out.lines.reduce((s, l) => s + l.amount, 0);
    if (out.lines.length && total !== dca) bad++;
  }
  check("somme des composantes = montant affiché, sur 20 cas", bad === 0, `${bad} écart(s)`);
}

console.log("\nCAS LIMITES");
{
  const vide = optimizePlan([], new Map(), P({}), 500);
  check("portefeuille vide → plan vide et cible fournie", vide.lines.length === 0 && vide.target.equityShare > 0);

  const seul = [A("a", "ETF Monde", 10_000)];
  const out = optimizePlan(seul, new Map([["a", An({})]]), P({}), 500);
  check("une seule ligne → plan valide", out.lines.length === 1 && out.lines[0]!.amount === 500);
  check("et concentration signalée", out.hhi >= 0.99 && out.warnings.length > 0, `HHI ${out.hhi.toFixed(2)}`);

  check("Herfindahl : deux lignes égales", Math.abs(herfindahl([{ amount: 50 }, { amount: 50 }]) - 0.5) < 0.01);
}

console.log("\nALLOCATION CIBLE");
{
  const portfolio = [A("a", "ETF Monde", 10_000)];
  const analyses = new Map([["a", An({ volatility: 18 })]]);
  const prudent = targetAllocation(P({ riskProfile: "prudent" }), portfolio, analyses);
  const offensif = targetAllocation(P({ riskProfile: "offensif" }), portfolio, analyses);
  check(
    "part actions croît avec le profil",
    prudent.equityShare < offensif.equityShare,
    `${(prudent.equityShare * 100).toFixed(0)} % vs ${(offensif.equityShare * 100).toFixed(0)} %`,
  );
}

void classifyPocket;
console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
if (failures) process.exit(1);

console.log("\nPOCHE DÉFENSIVE");
{
  const portfolio = [
    A("w", "ETF MSCI World", 10_123),
    A("s", "ETF S&P 500", 5_184),
    A("e", "ETF Stoxx Europe 600", 3_653),
    A("m", "ETF MSCI Émergent", 2_664),
    { id: "l", type: "livret", data: { name: "Livret A", amount: 22_700, taux: 1.7 }, createdAt: "", updatedAt: "" } as unknown as Asset,
    { id: "av", type: "av", data: { name: "Assurance vie", fondsEurosAmount: 176 }, createdAt: "", updatedAt: "" } as unknown as Asset,
  ];
  const analyses = new Map<string, Analysis>([
    ["w", An({ volatility: 15, composite: { score: 0.2, kind: "conserver", parts: [] } as never })],
    ["s", An({ volatility: 17, composite: { score: 0.2, kind: "conserver", parts: [] } as never })],
    ["e", An({ volatility: 14, composite: { score: 0.2, kind: "conserver", parts: [] } as never })],
    ["m", An({ volatility: 18, composite: { score: 0.43, kind: "conserver", parts: [] } as never })],
    ["l", An({ volatility: 0.5 })],
    ["av", An({ volatility: 1.5 })],
  ]);
  const profile = P({ riskProfile: "dynamique", age: 33 });

  const status = defensiveGap(portfolio, profile, analyses);
  check(
    "poche défensive déjà couverte détectée",
    status.covered,
    `${Math.round(status.current)} € pour ${Math.round(status.target)} € visés`,
  );

  const out = optimizePlan(portfolio, analyses, profile, 500);
  const avAmount = out.lines.find((l) => l.assetId === "av")?.amount ?? 0;
  check("aucun versement sur le support sécurisé", avAmount === 0, `${avAmount} €`);
  check("le message l'explique", (out.warnings[0] ?? "").includes("sécurisée"));

  const em = out.lines.find((l) => l.assetId === "m");
  check(
    "signal 0,43 sans sous-pondération → maintenir",
    !em || em.action === "maintenir",
    em ? em.action : "absente",
  );
  const total = out.lines.reduce((s, l) => s + l.amount, 0);
  check("somme exacte et lignes au-dessus du minimum", total === 500 && out.lines.every((l) => l.amount >= 25));
  check("immobilier exclu des poches", isFinancial(A("i", "x", 1)) && !isFinancial({ id: "z", type: "immo", data: {}, createdAt: "", updatedAt: "" } as unknown as Asset));
}

console.log("\nCHEVAUCHEMENT");
{
  const world = A("w", "ETF MSCI World", 10_000);
  const sp = A("s", "ETF S&P 500", 5_000);
  const eu = A("e", "ETF Stoxx Europe 600", 3_000);
  const rate = overlap(world, sp);
  check("World et S&P 500 se recouvrent fortement", rate > 0.6, `${(rate * 100).toFixed(0)} %`);
  check("World et Europe se recouvrent peu", overlap(world, eu) < 0.3, `${(overlap(world, eu) * 100).toFixed(0)} %`);

  const exp = realExposure([world]);
  check(
    "un ETF monde seul expose bien aux États-Unis",
    (exp.byZone["États-Unis"] ?? 0) > 0.6,
    `${((exp.byZone["États-Unis"] ?? 0) * 100).toFixed(0)} %`,
  );
  check("concentration mesurée sur les expositions", concentrationIndex(exp.byZone) > 0.3);
}

console.log("\nTABLE DES LIBELLÉS");
{
  check("signal fort + sous-pondéré → renforcer", planLabel(0.5, 8) === "renforcer");
  check("signal fort mais à la cible → maintenir", planLabel(0.5, 0) === "maintenir");
  check("signal neutre + sous-pondéré → rattraper", planLabel(0.1, 8) === "rattraper");
  check("signal neutre + surpondéré → réduire", planLabel(0.1, -8) === "reduire");
  check("signal négatif + sous-pondéré → maintenir", planLabel(-0.4, 8) === "maintenir");
  check("signal 0,43 avec écart −1 pt → maintenir", planLabel(0.43, -1) === "maintenir");
}

console.log("\nLE SOLVEUR RÉSOUT VRAIMENT");
{
  // Deux supports aux écarts très différents ne peuvent pas recevoir le
  // même montant : des montants identiques trahiraient un repli uniforme.
  const portfolio = [
    A("us", "ETF S&P 500", 20_000),
    A("eu", "ETF Stoxx Europe 600", 1_000),
    A("em", "ETF MSCI Émergent", 1_000),
  ];
  const analyses = new Map<string, Analysis>(
    portfolio.map((a) => [a.id, An({ volatility: 15 })]),
  );
  const out = optimizePlan(portfolio, analyses, P({ riskProfile: "equilibre", age: 33 }), 500);
  const amounts = out.lines.map((l) => l.amount);
  const uniform = amounts.length > 1 && new Set(amounts).size === 1;
  check("montants différenciés selon l'écart", !uniform, amounts.join(" / ") + " €");
  check("total exact", amounts.reduce((s, v) => s + v, 0) === 500);
}

console.log("\nUN SEUL VÉHICULE PAR ZONE EN MODE NEUTRE");
{
  const portfolio = [
    A("w", "ETF MSCI World", 10_000),
    A("s", "ETF S&P 500", 5_000),
    A("e", "ETF Stoxx Europe 600", 3_000),
  ];
  const analyses = new Map<string, Analysis>(
    portfolio.map((a) => [a.id, An({ volatility: 15 })]),
  );
  const out = optimizePlan(portfolio, analyses, P({ riskProfile: "equilibre", age: 33 }), 500);
  const sp = out.lines.find((l) => l.assetId === "s");
  check("le support redondant n'est pas financé", !sp, sp ? `${sp.amount} €` : "0 €");
  check(
    "et la raison est donnée",
    out.violations.some((v) => v.code === "single_vehicle"),
  );
}

console.log("\nAJOUT MANUEL D'UNE LIGNE");
{
  const portfolio = [
    A("w", "ETF MSCI World", 10_000),
    A("s", "ETF S&P 500", 5_000),
    A("e", "ETF Stoxx Europe 600", 3_000),
  ];
  const analyses = new Map<string, Analysis>(portfolio.map((a) => [a.id, An({ volatility: 15 })]));
  const profile = P({ riskProfile: "equilibre", age: 33 });

  const sans = optimizePlan(portfolio, analyses, profile, 500);
  const avec = optimizePlan(portfolio, analyses, profile, 500, { included: ["s"] });

  check("sans ajout, le support redondant reste écarté", !sans.lines.some((l) => l.assetId === "s"));
  check("ajouté à la main, il entre au plan", avec.lines.some((l) => l.assetId === "s"));
  check(
    "et la répartition est recalculée, pas complétée",
    avec.lines.reduce((s, l) => s + l.amount, 0) === 500 &&
      (avec.lines.find((l) => l.assetId === "w")?.amount ?? 0) <
        (sans.lines.find((l) => l.assetId === "w")?.amount ?? 0),
  );
  check("chaque ligne reste au-dessus du minimum", avec.lines.every((l) => l.amount >= 25));
}
