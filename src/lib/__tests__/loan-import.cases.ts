import { applyLoanDecisions, matchLoan, parseLoanCapture, parseLoanCaptures } from "../loan-import";
import { buildSchedule, remainingCapital } from "../loans";
import type { Asset } from "../types";
import { detectCaptureKind, dominantKind } from "../capture-kind";
import { positionParserCases } from "./position-parser.cases";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const near = (a: number | null | undefined, b: number, tolerance = 0.006) => a != null && Math.abs(a - b) <= tolerance;
const NOW = new Date(2026, 10, 23, 15, 40);

// Captures de l'appli BoursoBank, texte tel que lu par l'OCR de l'appli. Montants fictifs (prêt lissé
// de 131 500 € à 1,15 % + PTZ de 60 000 €), recalculés pour rester cohérents entre eux.
const pretHaut = `15:37 à ll > |
x Caractéristiques du compte
CARACTERISTIQUES DE VOTRE PRET
Titulaire du contrat M. DUPONT JEAN
Montant de votre prét 131 500,00 €
Capital restant dû 91 466,66 €
Impayés 0,00 €
Charges dues 0,00 €
VOS REMBOURSEMENTS
Taux 1,15 %
Durée 300 mois
Nombre d'amortissements restants 231
Date d'échéance 04/02/2046
Phase en cours Non
VOTRE PROCHAIN REMBOURSEMENT
Montant de l'amartissament BON GRE`;
const pretBas = `15:37 à ll > |
X Caractéristiques du compte
vuree 3UU MOIS
Nombre d'amortissements restants 231
Date d'échéance 04/02/2046
Phase en cours Non
VOTRE PROCHAIN REMBOURSEMENT
Montant de l'amortissement 687,52 €
Capital amorti 599,86 €
Intérêts dus 87,66 €
Assurance due 0,00 €
Charges remboursées 0,00 €
Charges reportées 0,00 €
Capital restant dû après amortissement 90
866,80
€
Date du prochain amortissement 04/12/2026`;
const ptzHaut = `15:36 à ll S |
X Caractéristiques du compte
CARACTÉRISTIQUES DE VOTRE PRÊT
Titulaire du contrat M. DUPONT JEAN
Montant de votre prêt 60 000,00 €
Capital restant dû 60 000,00 €
Impayés 0,00 €
Charges dues 0,00 €
VOS REMBOURSEMENTS
Taux 0,00 %
Durée 300 mois
Nombre d'amortissements restants 299
Date d'échéance 04/02/2046
Phase en cours Non
VOTRE PROCHAIN REMBOURSEMENT
Montant de l'amortissement 0,00 €`;
const ptzBas = `15:36 2 ll > |
X Caractéristiques du compte
vuree 3UU MOIS
Nombre d'amortissements restants 299
Date d'échéance 04/02/2046
Phase en cours Non
VOTRE PROCHAIN REMBOURSEMENT
Montant de l'amortissement 0,00 €
Capital amorti 0,00 €
Intérêts dus 0,00 €
Assurance due 0,00 €
Charges remboursées 0,00 €
Charges reportées 0,00 €
Capital restant dû après amortissement 60
000,00
€
Date du prochain amortissement 04/03/2021`;

console.log("\nLECTURE D'UNE CAPTURE");
const bas = parseLoanCapture(pretBas).fields;
check("montant coupé sur trois lignes recollé", near(bas.capitalRestantApres?.value, 90866.8));
check("intitulé illisible (« vuree 3UU MOIS ») ignoré sans erreur", bas.dureeMois === undefined);
check("échéance, capital amorti, intérêts, assurance", near(bas.echeance?.value, 687.52) && near(bas.capitalAmorti?.value, 599.86) && near(bas.interets?.value, 87.66) && bas.assurance?.value === 0);
const haut = parseLoanCapture(pretHaut).fields;
check("« prét » mal accentué reconnu, titulaire et impayés ignorés", near(haut.capitalInitial?.value, 131500) && near(haut.capitalRestant?.value, 91466.66));
check("date d'échéance = date de fin (pas une mensualité)", haut.dateFin?.value === 2046 * 12 + 1 && haut.echeance === undefined);

console.log("\nAPPLI BOURSOBANK : 2 PRÊTS LISSÉS, 4 CAPTURES DANS LE DÉSORDRE");
const result = parseLoanCaptures([ptzBas, pretHaut, ptzHaut, pretBas], NOW);
check("2 prêts reconnus", result.prets.length === 2, `${result.prets.length}`);
const pret = result.prets.find((loan) => loan.capitalInitial === 131500);
const ptz = result.prets.find((loan) => loan.capitalInitial === 60000);
check("captures du même prêt fusionnées", pret?.captures === 2 && ptz?.captures === 2);
check("prêt principal : taux, durée, 1re échéance calculée", pret?.taux === 1.15 && pret?.dureeMois === 300 && pret?.dateDebut === "2021-03" && pret?.dateFin === "2046-02");
check("prêt principal : mensualité hors assurance", near(pret?.mensualite, 687.52));
check("prêt principal : capital restant recalé fin novembre 2026", pret?.refDate === "2026-11" && near(pret?.refCapital, 91466.66));
check("intérêts du mois vérifiés", Boolean(pret?.verifications.some((v) => v.startsWith("Intérêts du mois"))));
check("PTZ : taux zéro, différé, même terme", ptz?.taux === 0 && ptz?.mensualite === 0 && ptz?.dateDebut === "2021-03" && ptz?.type === "Prêt à 0 %");
const mainTiers = pret?.paliers ?? [];
const ptzTiers = ptz?.paliers ?? [];
check("lissage détecté : bascule au 181e mois (mars 2036)", mainTiers[1]?.debutMois === 181 && ptzTiers[1]?.debutMois === 181, JSON.stringify(mainTiers));
check("PTZ remboursé 500 € par mois sur 10 ans", near(ptzTiers[1]?.mensualite, 500, 0.01) && ptzTiers[0]?.mensualite === 0);
check("prêt principal ≈ 187,5 € ensuite, total ≈ 687,52 €", near(mainTiers[1]?.mensualite, 187.5, 0.5) && near((mainTiers[1]?.mensualite ?? 0) + (ptzTiers[1]?.mensualite ?? 0), 687.52, 1));
check("confiance élevée sur les deux prêts", (pret?.confiance ?? 0) >= 0.8 && (ptz?.confiance ?? 0) >= 0.7, `${pret?.confiance} / ${ptz?.confiance}`);

// Le tableau d'amortissement de l'appli retombe à zéro au terme avec ces paliers.
const assetData = (loan: NonNullable<typeof pret>) => ({
  capitalInitial: loan.capitalInitial,
  taux: loan.taux,
  dureeMois: loan.dureeMois,
  dateDebut: loan.dateDebut,
  mensualite: loan.mensualite,
  refDate: loan.refDate,
  refCapital: loan.refCapital,
  paliers: JSON.stringify(loan.paliers),
});
const mainSchedule = buildSchedule(assetData(pret!));
const ptzSchedule = buildSchedule(assetData(ptz!));
check("tableau du prêt principal soldé en février 2046", mainSchedule.at(-1)?.date === "2046-02" && (mainSchedule.at(-1)?.restant ?? 1) === 0, `${mainSchedule.at(-1)?.date} ${mainSchedule.at(-1)?.restant}`);
check("tableau du PTZ soldé en février 2046", ptzSchedule.at(-1)?.date === "2046-02" && (ptzSchedule.at(-1)?.restant ?? 1) === 0, `${ptzSchedule.at(-1)?.date}`);
check("capital restant aujourd'hui = relevé de la banque", near(remainingCapital(assetData(pret!), NOW), 91466.66, 0.01));
check("capital restant en décembre 2026 = « après amortissement »", near(remainingCapital(assetData(pret!), new Date(2026, 11, 10)), 90866.8, 0.02));

console.log("\nCAPTURE ISOLÉE : AVERTISSEMENTS UTILES");
const seul = parseLoanCaptures([pretHaut, pretBas], NOW).prets[0];
check("sans le PTZ : paliers non inventés, baisse future signalée", seul?.paliers === null && Boolean(seul?.avertissements.some((a) => a.includes("baissera"))));
const ptzSeul = parseLoanCaptures([ptzHaut], NOW).prets[0];
check("PTZ seul : différé signalé", Boolean(ptzSeul?.avertissements.some((a) => a.includes("différé"))));

console.log("\nAUTRES BANQUES, AUTRES MISES EN PAGE");
// Intitulé au-dessus de la valeur.
const dessus = parseLoanCaptures([`Prêt Habitat
Montant emprunté
200 000,00 €
Capital restant dû
117 881,47 €
Taux nominal
1,10 %
Durée
240 mois
Date de première échéance
05/03/2018
Mensualité hors assurance
928,74 €
Date de la prochaine échéance
05/12/2026`], NOW).prets[0];
check("intitulé au-dessus : tous les champs", dessus?.capitalInitial === 200000 && dessus?.taux === 1.1 && dessus?.dureeMois === 240 && dessus?.dateDebut === "2018-03" && near(dessus?.mensualite, 928.74) && near(dessus?.refCapital, 117881.47) && dessus?.refDate === "2026-11");
check("intitulé au-dessus : mensualité constante vérifiée, prêt immobilier", Boolean(dessus?.verifications.some((v) => v.includes("constante"))) && dessus?.type === "Prêt immobilier" && dessus?.paliers === null);

// « Intitulé : valeur », durée en années, date de fin en toutes lettres, assurance incluse.
const lcl = parseLoanCaptures([`LCL - Mes crédits
Crédit immobilier
Capital restant dû : 117 881,47 €
Montant initial : 200 000 €
Taux : 1,10 %
Durée : 20 ans
Fin du prêt : février 2038
Échéance mensuelle : 948,74 €
Dont assurance : 20,00 €`], NOW).prets[0];
check("« : » et années : durée 240 mois, fin février 2038, début mars 2018", lcl?.dureeMois === 240 && lcl?.dateFin === "2038-02" && lcl?.dateDebut === "2018-03");
check("mensualité hors assurance = échéance − assurance", near(lcl?.mensualite, 928.74) && lcl?.assurance === 20);
check("prêteur reconnu, mensualité constante vérifiée", lcl?.preteur === "LCL" && Boolean(lcl?.verifications.some((v) => v.includes("constante"))));

// Valeur au-dessus de l'intitulé (gros chiffre, légende dessous).
const dessous = parseLoanCaptures([`Mon prêt immo
117 881,47 €
Capital restant dû
928,74 €
Mensualité
1,10 %
Taux
Fin : 02/2038
Durée totale : 240 mois
Montant emprunté : 200 000,00 €`], NOW).prets[0];
check("valeur au-dessus de l'intitulé", near(dessous?.refCapital, 117881.47) && near(dessous?.mensualite, 928.74) && dessous?.taux === 1.1 && dessous?.dateFin === "2038-02");

const rien = parseLoanCaptures(["Mes comptes\nCompte courant\n1 234,56 €"], NOW);
check("capture sans crédit : rien d'inventé", rien.prets.length === 0 && rien.avertissements.length === 1);

console.log("\nRAPPROCHEMENT ET APPLICATION");
const existing: Asset = {
  id: "credit-principal",
  type: "credit",
  data: { name: "Prêt résidence", capitalInitial: 131500, taux: 1.15, dureeMois: 300, dateDebut: "2021-03", bienId: "bien-1" },
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};
check("prêt existant retrouvé par le montant emprunté", matchLoan(pret!, [existing])?.id === "credit-principal");
check("PTZ non confondu avec le prêt principal", matchLoan(ptz!, [existing]) === null);
const applied = applyLoanDecisions(
  [existing],
  [
    { action: "update", assetId: "credit-principal", appliquerPaliers: true, pret: pret! },
    { action: "create", bienId: "bien-1", appliquerPaliers: true, pret: ptz! },
  ],
  "2026-11-23T15:00:00.000Z",
  () => "nouveau-ptz",
);
const updated = applied.find((asset) => asset.id === "credit-principal");
const created = applied.find((asset) => asset.id === "nouveau-ptz");
check("mise à jour : nom et bien conservés, relevé et paliers appliqués", updated?.data["name"] === "Prêt résidence" && updated?.data["bienId"] === "bien-1" && updated?.data["refDate"] === "2026-11" && typeof updated?.data["paliers"] === "string");
check("création : PTZ rattaché au bien", created?.type === "credit" && created?.data["bienId"] === "bien-1" && created?.data["capitalInitial"] === 60000 && created?.data["dateDebut"] === "2021-03");
const sansPaliers = applyLoanDecisions([existing], [{ action: "update", assetId: "credit-principal", appliquerPaliers: false, pret: pret! }], "x", () => "y");
check("paliers non appliqués si décoché", sansPaliers[0]?.data["paliers"] === undefined);

console.log("\nTYPE DE CAPTURE DÉTECTÉ AUTOMATIQUEMENT");
check("fiches de crédit → crédit", [pretHaut, pretBas, ptzHaut, ptzBas].every((text) => detectCaptureKind(text) === "credit"));
check("positions de l'appli Boursorama → positions", detectCaptureKind(positionParserCases.boursoAppOcr) === "titres" && detectCaptureKind(positionParserCases.boursoTable) === "titres");
check("livret → solde", detectCaptureKind(positionParserCases.livretA) === "solde" && detectCaptureKind(positionParserCases.livretWithDate) === "solde");
check("texte ambigu → pas de devinette", detectCaptureKind("Bonjour\n12,00 €") === null);
const lot = dominantKind([pretHaut, pretBas, positionParserCases.boursoAppOcr]);
check("lot mélangé : type majoritaire et captures écartées comptées", lot.kind === "credit" && lot.others === 1);

console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
if (failures) process.exitCode = 1;
