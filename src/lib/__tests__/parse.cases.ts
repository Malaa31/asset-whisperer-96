import { parseAssetText } from "../parse";

/**
 * Jeu de tests de l'analyseur de description.
 *
 * Lancer : `npx tsx src/lib/__tests__/parse.cases.ts`
 * Chaque cas décrit une phrase réaliste (tapée ou dictée) et ce que
 * l'analyseur doit en tirer. Ajouter un cas ici avant de corriger un
 * comportement : la suite sert de garde-fou contre les régressions.
 */

interface Case {
  text: string;
  type?: string;
  expect?: Record<string, number | string>;
  incomplete?: boolean;
}

const CASES: Case[] = [
  { text: "j'ai une maison qui vaut 250 000 €", type: "immo", expect: { valeurEstimee: 250000 } },
  { text: "mon appartement est estimé à 180000", type: "immo", expect: { valeurEstimee: 180000 } },
  { text: "un studio locatif de 120 000 loué 550 par mois", type: "immo", expect: { valeurEstimee: 120000, loyer: 550 } },
  { text: "résidence principale 320k", type: "immo", expect: { valeurEstimee: 320000 } },
  { text: "j'ai acheté un appart 195 000", type: "immo", expect: { valeurEstimee: 195000 } },
  { text: "un prêt de 180 000 à 1,2% mensualité 592", type: "credit", expect: { capitalRestant: 180000, taux: 1.2, mensualite: 592 } },
  { text: "crédit immo, capital restant 90 896, mensualité 592,18", type: "credit", expect: { capitalRestant: 90896, mensualite: 592.18 } },
  { text: "il me reste 54 000 sur mon emprunt", type: "credit", expect: { capitalRestant: 54000 } },
  { text: "crédit auto 12 000 euros taux 3,5%", type: "credit", expect: { capitalRestant: 12000, taux: 3.5 } },
  { text: "action Air Liquide, 20 titres achetés à 150", type: "pea", expect: { quantity: 20, pru: 150 } },
  { text: "88 parts d'Amundi S&P 500 à 58,14, PRU 48,48", type: "pea", expect: { quantity: 88, pru: 48.48, currentPrice: 58.14 } },
  { text: "1622 parts d'ETF Monde", type: "pea", expect: { quantity: 1622 } },
  { text: "j'ai 168 BNP Stoxx Europe 600 au prix de revient de 20,06", type: "pea", expect: { quantity: 168, pru: 20.06 } },
  { text: "10 actions LVMH à 620 euros", type: "pea", expect: { quantity: 10, pru: 620 } },
  { text: "Livret A 22 700", type: "livret", expect: { amount: 22700 } },
  { text: "mon LDDS contient 6000 euros", type: "livret", expect: { amount: 6000 } },
  { text: "compte courant 5 628,47", type: "cash", expect: { amount: 5628.47 } },
  { text: "assurance vie 15 000", type: "av", expect: { fondsEurosAmount: 15000 } },
  { text: "j'ai une AV de 172,85 euros en fonds euros", type: "av", expect: { fondsEurosAmount: 172.85 } },
  { text: "bitcoin 0,5 à 60 000", type: "crypto", expect: { quantity: 0.5, prixUnitaire: 60000 } },
  { text: "j'ai 2 ethereum achetés 2500 chacun", type: "crypto", expect: { quantity: 2, prixUnitaire: 2500 } },
  { text: "alors j'ai un livret A avec vingt-deux mille euros", type: "livret" },
  { text: "euh mon PEL fait 15000 balles", type: "livret", expect: { amount: 15000 } },
  { text: "je possède une villa d'une valeur de 400 000 euros", type: "immo", expect: { valeurEstimee: 400000 } },
  { text: "il me reste à rembourser 75 000 euros sur le prêt de la maison", type: "credit", expect: { capitalRestant: 75000 } },
  { text: "j'ai mis 3000 euros sur mon assurance vie", type: "av", expect: { fondsEurosAmount: 3000 } },
  { text: "500 actions Total à 55 euros l'unité", type: "pea", expect: { quantity: 500, pru: 55 } },
  { text: "mon compte en banque a 1 250,30", type: "cash", expect: { amount: 1250.30 } },
  { text: "un ETF world pour 12 000 euros", type: "pea" },
  { text: "SCPI Corum 20 parts à 1090", type: "immo", expect: { valeurEstimee: 1090 } },
  { text: "j'ai emprunté 200000 sur 20 ans à 3,1%", type: "credit", expect: { capitalRestant: 200000, taux: 3.1 } },
  { text: "livret jeune 1600€", type: "livret", expect: { amount: 1600 } },
  { text: "0,25 btc", type: "crypto", expect: { quantity: 0.25 } },
  { text: "PEA avec 21 415,77 euros dessus", type: "pea" },
  { text: "mon prêt conso mensualité 250 euros par mois reste 8000", type: "credit", expect: { mensualite: 250, capitalRestant: 8000 } },
  { text: "prêt immo sur 25 ans, capital restant 145 000, taux 1,05, mensualité 620", type: "credit", expect: { capitalRestant: 145000, taux: 1.05, mensualite: 620 } },
  { text: "T3 de 65 m2 estimé 210 000", type: "immo", expect: { valeurEstimee: 210000 } },
  { text: "maison achetée 300 000 en 2019, vaut 350 000 aujourd'hui", type: "immo", expect: { valeurEstimee: 350000 } },
  { text: "j'ai 12 parts de SCPI Épargne Pierre à 208 euros", type: "immo" },
  { text: "livret A plafonné à 22 950", type: "livret", expect: { amount: 22950 } },
  { text: "assurance vie : 40 000 en fonds euros et 25 000 en UC", type: "av", expect: { fondsEurosAmount: 40000 } },
  { text: "PEA Amundi MSCI World 1229 parts PRU 5,65 cours 5,97", type: "pea", expect: { quantity: 1229, pru: 5.65, currentPrice: 5.97 } },
  { text: "crédit à 0% de 5000 euros", type: "credit", expect: { capitalRestant: 5000, taux: 0 } },
  { text: "ethereum : j'en ai 1,75 valorisés 3200 pièce", type: "crypto", expect: { quantity: 1.75 } },
  { text: "j'ai une maison", type: "immo", incomplete: true },
  { text: "bonjour", incomplete: true },
  { text: "mon livret", type: "livret", incomplete: true },
];

let ok = 0;
const fails: string[] = [];

for (const c of CASES) {
  const r = parseAssetText(c.text);
  const errs: string[] = [];
  if (c.type && r.type !== c.type) errs.push(`type=${r.type}≠${c.type}`);
  if (c.incomplete !== undefined && r.incomplete !== c.incomplete) {
    errs.push(`incomplete=${r.incomplete}≠${c.incomplete}`);
  }
  for (const [k, v] of Object.entries(c.expect ?? {})) {
    const got = r.data[k];
    const bad =
      typeof v === "number" ? Math.abs(Number(got) - v) > 0.01 : String(got) !== v;
    if (bad) errs.push(`${k}=${got ?? "∅"}≠${v}`);
  }
  if (errs.length) {
    fails.push(`✗ "${c.text}"\n    ${errs.join(", ")} | ${JSON.stringify(r.data)}`);
  } else {
    ok++;
  }
}

console.log(`${ok}/${CASES.length} cas réussis`);
for (const f of fails) console.log(f);
if (fails.length) process.exitCode = 1;
