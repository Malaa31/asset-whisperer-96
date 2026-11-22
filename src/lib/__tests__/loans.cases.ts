import { assetValue, mensualite } from "../calc";
import { buildSchedule, loanSummary, remainingCapital } from "../loans";
import type { Asset } from "../types";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log("\nANNUITÉ STANDARD");
const standard = {
  capitalInitial: 200_000,
  taux: 1.3,
  dureeMois: 300,
  dateDebut: "2020-01",
};
const standardRows = buildSchedule(standard);
check("échéance conforme à calc.ts · mensualite (≈ 780,5 € indicatifs)", Math.abs(standardRows[0]!.echeance - mensualite(200_000, 1.3, 25)) < 1e-9, `${standardRows[0]!.echeance.toFixed(2)} €`);
check("fin à 300 mois", standardRows.length === 300 && standardRows[299]!.restant === 0);
check("CRD jamais négatif", standardRows.every((row) => row.restant >= 0));
const automaticAsset = {
  id: "credit-auto",
  type: "credit",
  data: { ...standard, capitalRestant: 1 },
  createdAt: "",
  updatedAt: "",
} as unknown as Asset;
check("valeur du crédit automatique = CRD calculé", assetValue(automaticAsset) === -remainingCapital(standard));

console.log("\nPTZ DIFFÉRÉ");
const ptz = {
  capitalInitial: 120_000,
  taux: 0,
  dureeMois: 240,
  dateDebut: "2020-01",
  paliers: JSON.stringify([
    { debutMois: 1, mensualite: 0 },
    { debutMois: 61, mensualite: 120_000 / 180 },
  ]),
};
const ptzRows = buildSchedule(ptz);
check("60 mois sans échéance", ptzRows.slice(0, 60).every((row) => row.echeance === 0 && row.restant === 120_000));
check("solde nul au terme", ptzRows.length === 240 && ptzRows.at(-1)!.restant === 0);

console.log("\nPRÊT À PALIERS");
const tiered = {
  capitalInitial: 180_000,
  taux: 3,
  dureeMois: 240,
  dateDebut: "2022-01",
  paliers: JSON.stringify([
    { debutMois: 1, mensualite: 500 },
    { debutMois: 61, mensualite: 1_000 },
  ]),
};
const tieredRows = buildSchedule(tiered);
check("paiement lissé avant changement", tieredRows[0]!.echeance === 500 && tieredRows[59]!.echeance === 500);
check("second palier appliqué", tieredRows[60]!.echeance === 1_000);
check("aucun solde négatif", tieredRows.every((row) => row.restant >= 0));

console.log("\nRECALIBRAGE BANCAIRE");
const recalibrated = {
  ...standard,
  refDate: "2022-06",
  refCapital: 175_000,
};
check("repart du capital du relevé", remainingCapital(recalibrated, new Date("2022-06-15T12:00:00Z")) === 175_000);
check("première échéance après le relevé", buildSchedule(recalibrated)[0]!.date === "2022-07");
check("baisse après échéance suivante", remainingCapital(recalibrated, new Date("2022-07-15T12:00:00Z")) < 175_000);

console.log("\nMODE MANUEL COMPATIBLE");
const manual = { capitalRestant: 42_500, mensualite: 390 };
check("solde manuel conservé", remainingCapital(manual) === 42_500);
const manualAsset = {
  id: "credit-manuel",
  type: "credit",
  data: manual,
  createdAt: "",
  updatedAt: "",
} as unknown as Asset;
check("valeur d'actif manuelle inchangée", assetValue(manualAsset) === -42_500);
check("résumé du crédit manuel", loanSummary(manual).mensualiteActuelle === 390);

console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
if (failures) process.exitCode = 1;
