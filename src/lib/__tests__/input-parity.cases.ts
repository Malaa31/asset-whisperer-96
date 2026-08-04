import { parseAssetText } from "../parse";

/**
 * Parité des trois voies de saisie.
 *
 * Lancer : `npx tsx src/lib/__tests__/input-parity.cases.ts`
 * Une ligne créée par dictée, par texte libre ou au formulaire doit
 * aboutir aux mêmes données enregistrées. Ce test vérifie qu'aucune
 * clé produite par l'analyseur n'est écartée par l'enregistrement du
 * modal — la dictée et le texte passent par le même chemin, donc la
 * parité entre eux est structurelle ; c'est la comparaison avec le
 * formulaire qui doit être surveillée.
 *
 * Les tableaux ci-dessous répliquent FIELDS et PRESERVED d'AssetModal :
 * les mettre à jour ensemble.
 */

// Réplique exacte de FIELDS du modal (clés conservées à l'enregistrement)
const FIELDS: Record<string, string[]> = {
  pea: ["name","ticker","isin","quantity","pru","currentPrice","sector","region","ter","currency"],
  av: ["name","assureur","dateOuverture","fondsEurosAmount","fondsEurosRendement","ucAmount","ucDescription"],
  livret: ["name","type","amount","taux"],
  immo: ["type","name","adresse","surface","dpe","annee","valeurEstimee","loyer"],
  crypto: ["name","ticker","quantity","prixUnitaire"],
  cash: ["name","amount"],
  autre: ["name","amount","description"],
  credit: ["type","name","preteur","capitalInitial","capitalRestant","taux","mensualite","dureeRestante","dateFin"],
};

const PRESERVED = ["envelope","region","sector","currency","isin","lastPriceUpdate"];

const PHRASES = [
  "j'ai une maison qui vaut 250 000 €",
  "crédit immo, capital restant 90 896, mensualité 592, taux 1,2 %",
  "88 parts d'Amundi S&P 500 à 58,14, PRU 48,48",
  "Livret A 22 700",
  "assurance vie 15 000",
  "bitcoin 0,5 à 60 000",
  "compte courant 5 628,47",
  "0,25 btc",
];

let issues = 0;
for (const p of PHRASES) {
  const r = parseAssetText(p);
  const allowed = FIELDS[r.type] ?? [];
  const dropped = Object.keys(r.data).filter((k) => !allowed.includes(k) && !PRESERVED.includes(k));
  if (dropped.length) {
    issues++;
    console.log(`⚠ "${p}" [${r.type}]`);
    console.log(`   perdu à l'enregistrement : ${dropped.map(k=>`${k}=${r.data[k]}`).join(", ")}`);
  }
}
console.log(
  issues
    ? `${issues} phrase(s) avec perte de données`
    : "Parité OK : dictée, texte libre et formulaire enregistrent les mêmes données",
);
if (issues) process.exitCode = 1;
