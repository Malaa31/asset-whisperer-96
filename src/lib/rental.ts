import { loanSummary } from "./loans";
import { n } from "./calc";
import type { Asset, Profile } from "./types";

export interface RentalSummary {
  loyerNetVacance: number;
  mensualitesCredits: number;
  cashFlowMensuel: number;
  rendementBrut: number;
  rendementNetCharges: number;
}

function percentage(value: unknown): number {
  return Math.max(0, Math.min(100, n(value))) / 100;
}

function annualCharges(property: Asset): number {
  const { data } = property;
  return Math.max(0, n(data["chargesCopro"])) +
    Math.max(0, n(data["taxeFonciere"])) +
    Math.max(0, n(data["assurancePNO"])) +
    Math.max(0, n(data["autresCharges"]));
}

export function rentAfterVacancy(property: Asset): number {
  return Math.max(0, n(property.data["loyer"])) * (1 - percentage(property.data["vacancePct"]));
}

export function rentalCashFlowMonthly(property: Asset, linkedCredits: Asset[] = []): number {
  const rent = rentAfterVacancy(property);
  const managedRent = rent * (1 - percentage(property.data["fraisGestionPct"]));
  const monthlyCharges = annualCharges(property) / 12;
  const creditPayments = linkedCredits
    .filter((credit) => credit.type === "credit" && credit.data["bienId"] === property.id)
    .reduce((sum, credit) => sum + loanSummary(credit.data).mensualiteActuelle, 0);
  return managedRent - monthlyCharges - creditPayments;
}

export function grossRentalYield(property: Asset): number {
  const purchasePrice = n(property.data["prixAchat"]) || n(property.data["valeurEstimee"]);
  return purchasePrice > 0 ? (Math.max(0, n(property.data["loyer"])) * 12 / purchasePrice) * 100 : 0;
}

export function netRentalYieldBeforeTax(property: Asset): number {
  const denominator = n(property.data["prixAchat"]) || n(property.data["valeurEstimee"]);
  if (denominator <= 0) return 0;
  const annualNetRent = rentAfterVacancy(property) * (1 - percentage(property.data["fraisGestionPct"])) * 12 - annualCharges(property);
  return (annualNetRent / denominator) * 100;
}

export function rentalSummary(property: Asset, linkedCredits: Asset[] = []): RentalSummary {
  return {
    loyerNetVacance: rentAfterVacancy(property),
    mensualitesCredits: linkedCredits
      .filter((credit) => credit.type === "credit" && credit.data["bienId"] === property.id)
      .reduce((sum, credit) => sum + loanSummary(credit.data).mensualiteActuelle, 0),
    cashFlowMensuel: rentalCashFlowMonthly(property, linkedCredits),
    rendementBrut: grossRentalYield(property),
    rendementNetCharges: netRentalYieldBeforeTax(property),
  };
}

export function effectiveIncomeMonthly(profile: Profile | null, assets: Asset[]): number {
  const manualIncome = !profile
    ? 0
    : profile.incomes?.length
      ? profile.incomes.reduce((sum, income) => sum + Math.max(0, n(income.amountMonthly)), 0)
      : Math.max(0, n(profile.incomeMonthly));
  const rentalIncome = assets
    .filter((asset) => asset.type === "immo" && n(asset.data["loyer"]) > 0)
    .reduce((sum, property) => sum + rentAfterVacancy(property), 0);
  return manualIncome + rentalIncome;
}
