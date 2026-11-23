import type { Asset } from "../types";
import { parsePositionText } from "../position-parser";
import { positionParserCases } from "./position-parser.cases";
import {
  applyImportDecisions,
  controlsForExtraction,
  matchPosition,
  matchSavingsAccount,
  parseFrenchNumber,
} from "../import-positions";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

const peaWorld: Asset = {
  id: "pea-world",
  type: "pea",
  data: {
    name: "Amundi MSCI World",
    ticker: "CW8.PA",
    isin: "LU1681043599",
    envelope: "PEA",
    quantity: 3,
    pru: 400,
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const ctoWorld: Asset = {
  ...peaWorld,
  id: "cto-world",
  data: { ...peaWorld.data, envelope: "CTO" },
};
const unrelated: Asset = {
  id: "livret-a",
  type: "livret",
  data: { name: "Livret A", amount: 2500 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const untouched: Asset = {
  id: "cash-account",
  type: "cash",
  data: { name: "Compte courant", amount: 800 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

async function run() {
  console.log("\nIMPORT DE CAPTURES — PARSEUR LOCAL");
  const headers = parsePositionText(positionParserCases.peaWithIsinAndHeaders, "titres");
  check("en-têtes et ISIN valides mappés dans les colonnes", headers.kind === "titres" && headers.enveloppe === "PEA" && headers.lignes[0]?.isin === "LU1681043599" && headers.lignes[0]?.quantite === 12 && headers.lignes[0]?.valeur === 5185.2);
  const mobile = parsePositionText(positionParserCases.mobileStack, "titres");
  check("mise en page mobile avec valeurs sur plusieurs lignes", mobile.kind === "titres" && mobile.enveloppe === "CTO" && mobile.lignes.length === 2 && mobile.lignes[0]?.valeur === 1450);
  const noIsin = parsePositionText(positionParserCases.noIsin, "titres");
  check("liste sans ISIN inférée par quantité × cours", noIsin.kind === "titres" && noIsin.lignes[0]?.quantite === 2.5 && noIsin.lignes[0]?.valeur === 475);
  const savings = parsePositionText(positionParserCases.livretA, "solde");
  check("solde du livret préféré au plafond et au taux", savings.kind === "solde" && savings.solde === 12345.67);
  const noisy = parsePositionText(positionParserCases.ocrNoise, "titres");
  check("confusions OCR numériques corrigées", noisy.kind === "titres" && noisy.lignes[0]?.quantite === 10 && noisy.lignes[0]?.cours === 102);
  const bourso = parsePositionText(positionParserCases.boursoTable, "titres");
  const b0 = bourso.kind === "titres" ? bourso.lignes[0] : undefined;
  const b1 = bourso.kind === "titres" ? bourso.lignes[1] : undefined;
  check("tableau Boursorama : colonnes collées séparées", bourso.kind === "titres" && bourso.lignes.length === 2 && b0?.quantite === 38 && b0?.pru === 452.13 && b0?.cours === 498.2 && b0?.valeur === 18931.6);
  check("tableau Boursorama : deuxième ligne et ISIN", b1?.nom === "BNP PARIBAS" && b1?.isin === "FR0000131104" && b1?.quantite === 25 && b1?.valeur === 1472.5);
  check("tableau Boursorama : la ligne Total n'est pas une position", bourso.kind === "titres" && !bourso.lignes.some((l) => /total/i.test(l.nom)));
  const tr = parsePositionText(positionParserCases.tradeRepublicCards, "titres");
  const t0 = tr.kind === "titres" ? tr.lignes[0] : undefined;
  check("cartes mobiles : quantité « actions », valeur en €, % ignoré", tr.kind === "titres" && tr.lignes.length === 2 && t0?.nom === "Air Liquide" && t0?.quantite === 12.5 && t0?.valeur === 2103.75 && t0?.pru === null);
  check("cartes mobiles : cours déduit et signalé", Math.abs((t0?.cours ?? 0) - 168.3) < 0.01 && tr.kind === "titres" && tr.avertissements.some((a) => a.includes("Air Liquide")));
  const etf = parsePositionText(positionParserCases.etfNamesWithNumbers, "titres");
  const e0 = etf.kind === "titres" ? etf.lignes[0] : undefined;
  const e1 = etf.kind === "titres" ? etf.lignes[1] : undefined;
  check("noms d'ETF avec chiffres (S&P 500, CAC 40) conservés", etf.kind === "titres" && etf.lignes.length === 2 && e0?.nom === "AMUNDI PEA S&P 500 UCITS ETF" && e0?.quantite === 40 && e0?.valeur === 1408 && e1?.nom === "LYXOR CAC 40" && e1?.quantite === 10 && e1?.cours === 75.5);
  const detail = parsePositionText(positionParserCases.mobileDetail, "titres");
  const d0 = detail.kind === "titres" ? detail.lignes[0] : undefined;
  check("fiche détaillée avec étiquettes (Quantité, PRU, cours, valorisation)", detail.kind === "titres" && detail.lignes.length === 1 && d0?.isin === "FR0000120073" && d0?.quantite === 12 && d0?.pru === 150 && d0?.cours === 168.3 && d0?.valeur === 2019.6);
  const wrapped = parsePositionText(positionParserCases.wrappedNames, "titres");
  const w0 = wrapped.kind === "titres" ? wrapped.lignes[0] : undefined;
  const w1 = wrapped.kind === "titres" ? wrapped.lignes[1] : undefined;
  check("nom sur deux lignes recollé, « CAC 40 » seul reste un nom", wrapped.kind === "titres" && wrapped.lignes.length === 2 && w0?.nom === "AMUNDI MSCI WORLD UCITS ETF EUR (C)" && w0?.quantite === 5 && w0?.valeur === 2562 && w1?.nom === "Amundi CAC 40" && w1?.quantite === 3 && w1?.cours === 110);
  const close = parsePositionText(positionParserCases.closePruCours, "titres");
  const c0 = close.kind === "titres" ? close.lignes[0] : undefined;
  check("PRU proche du cours : pas d'inversion", c0?.quantite === 60 && c0?.pru === 1234.5 && c0?.cours === 1240 && c0?.valeur === 74400);
  const expectedBourso = [
    ["AMUNDI PEA EMERGENT (MSCI EMERGING) ESG TRANSITION UCITS ETF", 82, 27.91, 31.61, 2591.61],
    ["AMUNDI PEA MONDE MSCI WORLD UCITS ETF ACC", 1867, 5.8, 6.01, 11224.4],
    ["AMUNDI PEA S&P 500 UCITS ETF ACC", 88, 48.48, 57.08, 5023.04],
    ["BNP PARIBAS EASY STOXX EUROPE 600 UCITS ETF CAPITALISATION", 168, 20.06, 20.86, 3504.48],
    ["CARMAT", 15, 22.13, 0.1, 1.49],
  ] as const;
  for (const [label, key] of [["OCR", "boursoAppOcr"], ["Live Text", "boursoAppLiveText"]] as const) {
    const app = parsePositionText(positionParserCases[key], "titres");
    const lignes = app.kind === "titres" ? app.lignes : [];
    const same = (a: number | null | undefined, b: number) => a != null && Math.abs(a - b) < 0.005;
    check(`appli Boursorama (${label}) : 5 lignes, PEA`, app.kind === "titres" && app.enveloppe === "PEA" && lignes.length === 5);
    expectedBourso.forEach(([nom, q, pru, cours, valeur], i) => {
      const l = lignes[i];
      check(
        `appli Boursorama (${label}) : ${nom.split(" ").slice(0, 4).join(" ")}`,
        l?.nom === nom && same(l.quantite, q) && same(l.pru, pru) && same(l.cours, cours) && same(l.valeur, valeur) && l.confiance >= 0.7,
      );
    });
  }
  const expectedBourso2 = [
    ["AMUNDI PEA EMERGENT (MSCI EMERGING) ESG TRANSITION UCITS ETF", 82, 27.91, 33.09, 2712.97],
    ["AMUNDI PEA MONDE MSCI WORLD UCITS ETF ACC P", 1867, 5.8, 6.08, 11360.69],
    ["AMUNDI PEA S&P 500 UCITS ETF ACC", 88, 48.48, 57.8, 5086.4],
    ["BNP PARIBAS EASY STOXX EUROPE 600 UCITS ETF CAPITALISATION", 168, 20.06, 20.98, 3524.64],
    ["CARMAT", 15, 22.13, 0.1, 1.49],
  ] as const;
  for (const [label, key] of [["2e capture", "boursoAppOcr2"], ["flèches collées", "boursoAppOcr2Stuck"]] as const) {
    const app = parsePositionText(positionParserCases[key], "titres");
    const lignes = app.kind === "titres" ? app.lignes : [];
    const same = (a: number | null | undefined, b: number) => a != null && Math.abs(a - b) < 0.005;
    check(`appli Boursorama (${label}) : 5 lignes, aucune ligne écartée`, lignes.length === 5 && app.avertissements.length === 0);
    expectedBourso2.forEach(([nom, q, pru, cours, valeur], i) => {
      const l = lignes[i];
      check(
        `appli Boursorama (${label}) : ${nom.split(" ").slice(0, 4).join(" ")}`,
        l?.nom === nom && same(l.quantite, q) && same(l.pru, pru) && same(l.cours, cours) && same(l.valeur, valeur) && l.confiance >= 0.7,
      );
    });
  }
  const livretDate = parsePositionText(positionParserCases.livretWithDate, "solde");
  check("livret : la date n'est pas prise pour le solde", livretDate.kind === "solde" && livretDate.solde === 8412.35);
  const livretInline = parsePositionText(positionParserCases.livretInline, "solde");
  check("livret : solde sur la même ligne, numéro de compte ignoré", livretInline.kind === "solde" && livretInline.solde === 15300);

  console.log("\nIMPORT DE CAPTURES — NOMBRES FRANÇAIS");
  check("séparateurs de milliers et virgule décimale", parseFrenchNumber("1 234,56 €") === 1234.56);
  check("entier français avec espaces", parseFrenchNumber("12 345") === 12345);
  check("nombre décimal avec point", parseFrenchNumber("23.75") === 23.75);
  check("texte non numérique refusé", parseFrenchNumber("12€abc") === null);
  check("nombre infini refusé", parseFrenchNumber(Number.POSITIVE_INFINITY) === null);

  console.log("\nIMPORT DE CAPTURES — CORRESPONDANCES");
  check(
    "ISIN prioritaire sur ticker et nom, dans la même enveloppe",
    matchPosition(
      { nom: "autre nom", isin: "LU1681043599", ticker: "NOT-MATCH" },
      [peaWorld, ctoWorld],
      "PEA",
    )?.id === "pea-world",
  );
  check(
    "une correspondance ISIN ne traverse pas les enveloppes",
    matchPosition({ nom: "aucun", isin: "LU1681043599" }, [peaWorld, ctoWorld], "CTO")?.id ===
      "cto-world",
  );
  check(
    "ticker utilisé en second choix",
    matchPosition({ nom: "nom différent", ticker: "cw8.pa" }, [peaWorld], "PEA")?.id ===
      "pea-world",
  );
  check(
    "nom proche utilisé en dernier choix",
    matchPosition({ nom: "Amundi MSCI World ETF" }, [peaWorld], "PEA")?.id === "pea-world",
  );
  {
    const world = { ...peaWorld, id: "pea-world-2", data: { ...peaWorld.data, name: "Amundi MSCI World", isin: "" } };
    const emerging = { ...peaWorld, id: "pea-em", data: { ...peaWorld.data, name: "Amundi PEA Emergent", isin: "" } };
    const sp = { ...peaWorld, id: "pea-sp", data: { ...peaWorld.data, name: "Amundi S&P 500", isin: "" } };
    const pool = [world, emerging, sp];
    check(
      "libellé long de la banque rapproché du nom court saisi",
      matchPosition({ nom: "AMUNDI PEA MONDE MSCI WORLD UCITS ETF ACC" }, pool, "PEA")?.id === "pea-world-2" &&
        matchPosition({ nom: "AMUNDI PEA S&P 500 UCITS ETF ACC" }, pool, "PEA")?.id === "pea-sp" &&
        matchPosition({ nom: "AMUNDI PEA EMERGENT (MSCI EMERGING) ESG TRANSITION UCITS ETF" }, pool, "PEA")?.id === "pea-em",
    );
    check(
      "un seul mot commun (« Amundi ») ne suffit pas",
      matchPosition({ nom: "AMUNDI EURO STOXX 50" }, pool, "PEA") === null,
    );
  }
  check(
    "livret rapproché par libellé",
    matchSavingsAccount({ libelle: "Livret A" }, [unrelated])?.id === "livret-a",
  );

  console.log("\nIMPORT DE CAPTURES — CONTRÔLES");
  const controls = controlsForExtraction({
    kind: "titres",
    lignes: [
      { nom: "Ligne alerte", quantite: 10, cours: 10, valeur: 120, confiance: 0.5 },
      {
        nom: "Ligne cohérente",
        isin: "FR1234567890",
        quantite: 10,
        pru: 10,
        valeur: 102,
        confiance: 0.9,
      },
    ],
    avertissements: [],
  });
  check(
    "écart strictement supérieur à 2 %, absence d'identifiant et faible confiance signalés",
    controls[0]?.avertissements.length === 3,
  );
  check(
    "écart inférieur ou égal à 2 % sans alerte de calcul",
    controls[1]?.avertissements.length === 0,
  );
  check(
    "confiance faible signalée pour un solde",
    controlsForExtraction({ kind: "solde", solde: 100, confiance: 0.69, avertissements: [] })[0]
      ?.avertissements.length === 1,
  );

  console.log("\nIMPORT DE CAPTURES — APPLICATION ATOMIQUE");
  const applied = applyImportDecisions(
    [peaWorld, unrelated, untouched],
    [
      {
        kind: "titres",
        action: "update",
        assetId: "pea-world",
        enveloppe: "PEA",
        ligne: {
          nom: "Amundi MSCI World",
          isin: "LU1681043599",
          ticker: "CW8.PA",
          quantite: 4,
          pru: 405,
          cours: 420,
          confiance: 0.98,
        },
      },
      {
        kind: "titres",
        action: "create",
        enveloppe: "CTO",
        ligne: { nom: "Nouvelle action", ticker: "NEW.PA", quantite: 2, pru: 12, confiance: 0.9 },
      },
      {
        kind: "solde",
        action: "update",
        assetId: "livret-a",
        ligne: { libelle: "Livret A", solde: 2600, confiance: 0.99 },
      },
      {
        kind: "titres",
        action: "ignore",
        enveloppe: "PEA",
        ligne: { nom: "À ignorer", quantite: 1, confiance: 1 },
      },
    ],
    "2026-11-23T12:00:00.000Z",
    () => "new-asset",
  );
  check(
    "la mise à jour conserve l'identifiant et applique les champs importés",
    applied[0]?.id === "pea-world" &&
      applied[0]?.data["quantity"] === 4 &&
      applied[0]?.data["pru"] === 405,
  );
  check(
    "une nouvelle ligne est créée avec une référence et un horodatage",
    applied[3]?.id === "new-asset" &&
      applied[3]?.data["lastImportAt"] === "2026-11-23T12:00:00.000Z",
  );
  check(
    "le solde du livret est mis à jour",
    applied.find((asset) => asset.id === "livret-a")?.data["amount"] === 2600,
  );
  check(
    "un actif sans rapport reste inchangé",
    applied.find((asset) => asset.id === "cash-account") === untouched,
  );
  check("une ligne ignorée ne crée rien", applied.length === 4);

  console.log(`\nRésultat : ${passed} réussis, ${failed} échoués.`);
  if (failed > 0) process.exitCode = 1;
}


void run();
