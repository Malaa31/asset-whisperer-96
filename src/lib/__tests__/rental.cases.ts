import { effectiveIncomeMonthly, grossRentalYield, netRentalYieldBeforeTax, rentalCashFlowMonthly } from "../rental";
import { bufferStatus } from "../plan";
import type { Asset, Profile } from "../types";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const property = {
  id: "bien-1",
  type: "immo",
  data: {
    name: "Appartement",
    valeurEstimee: 220_000,
    prixAchat: 200_000,
    loyer: 1_500,
    chargesCopro: 1_200,
    taxeFonciere: 900,
    assurancePNO: 180,
    autresCharges: 120,
    fraisGestionPct: 8,
    vacancePct: 5,
  },
  createdAt: "",
  updatedAt: "",
} as unknown as Asset;
const credit = {
  id: "credit-1",
  type: "credit",
  data: { bienId: "bien-1", capitalRestant: 100_000, mensualite: 1_000 },
  createdAt: "",
  updatedAt: "",
} as unknown as Asset;

console.log("\nRENDEMENT LOCATIF");
check("rendement brut", Math.abs(grossRentalYield(property) - 9) < 1e-9, `${grossRentalYield(property).toFixed(2)} %`);
check("rendement net de charges avant impôts et crédit", Math.abs(netRentalYieldBeforeTax(property) - 6.666) < 0.01, `${netRentalYieldBeforeTax(property).toFixed(2)} %`);
check("cash-flow mensuel après charges, gestion et crédit", Math.abs(rentalCashFlowMonthly(property, [credit]) - 111) < 1e-9, `${rentalCashFlowMonthly(property, [credit]).toFixed(2)} €`);

console.log("\nREVENUS MENSUELS EFFECTIFS");
const profile = {
  incomeMonthly: 2_000,
  incomes: [{ id: "salaire", kind: "salaire", label: "Salaire", amountMonthly: 2_000 }],
} as unknown as Profile;
check("revenu manuel + loyer après vacance", Math.abs(effectiveIncomeMonthly(profile, [property]) - 3_425) < 1e-9);
check("profil ancien sans lignes de revenus reste compatible", effectiveIncomeMonthly({ incomeMonthly: 2_000 } as Profile, []) === 2_000);
const reserve = { id: "livret", type: "livret", data: { amount: 1_000 }, createdAt: "", updatedAt: "" } as unknown as Asset;
const status = bufferStatus([property, reserve], profile);
check("le buffer utilise les loyers dans le revenu mensuel", Math.abs((status.months ?? 0) - 1_000 / 3_425) < 1e-9);

console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
if (failures) process.exitCode = 1;
