import type { Asset } from "../types";
import {
  applyImportDecisions,
  consumeImportQuota,
  controlsForExtraction,
  matchPosition,
  matchSavingsAccount,
  parseFrenchNumber,
  type ImportQuotaStore,
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

  console.log("\nIMPORT DE CAPTURES — QUOTA CAS");
  const quota = new MemoryQuotaStore();
  const first = await consumeImportQuota(quota, "2026-11-23", 2);
  const second = await consumeImportQuota(quota, "2026-11-23", 2);
  const third = await consumeImportQuota(quota, "2026-11-23", 2);
  check(
    "deux imports sont autorisés et le suivant est refusé au plafond",
    first && second && !third,
  );
  check(
    "les jours UTC ont des compteurs distincts",
    await consumeImportQuota(quota, "2026-11-24", 2),
  );

  console.log(`\nRésultat : ${passed} réussis, ${failed} échoués.`);
  if (failed > 0) process.exitCode = 1;
}

class MemoryQuotaStore implements ImportQuotaStore {
  private records = new Map<string, { count: number; etag: string }>();
  private revision = 0;

  async get(day: string) {
    const record = this.records.get(day);
    return record ? { ...record } : null;
  }

  async compareAndSet(day: string, count: number, expectedEtag: string | null) {
    const current = this.records.get(day);
    if ((current?.etag ?? null) !== expectedEtag) return false;
    this.revision += 1;
    this.records.set(day, { count, etag: `etag-${this.revision}` });
    return true;
  }
}

void run();
