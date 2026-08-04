export type RiskProfile = "prudent" | "equilibre" | "dynamique" | "offensif";

export type AssetType =
  | "pea"
  | "av"
  | "livret"
  | "immo"
  | "crypto"
  | "cash"
  | "autre"
  | "credit";

export type GoalKind = "patrimoine" | "enveloppe" | "immo" | "libre";

export interface Goal {
  id: string;
  kind: GoalKind;
  label: string;
  amount: number;
  horizon: number;
  dca: number;
  rate?: number;
  /** Type d'actif ciblé pour un objectif d'enveloppe (ex. "pea"). */
  scope?: AssetType;
}

export interface Profile {
  name: string;
  age: number;
  profession: string;
  incomeMonthly: number;
  riskProfile: RiskProfile;
  goal: { amount: number; horizon: number; dca: number };
  goals?: Goal[];
  activeGoalId?: string;
  hideAmounts?: boolean;
}


export interface Asset {
  id: string;
  type: AssetType;
  data: Record<string, string | number | undefined>;
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  date: string;
  patrimoineNet: number;
  totalActifs: number;
  totalDettes: number;
}

export const TYPE_LABELS: Record<AssetType, string> = {
  pea: "Bourse",
  av: "Assurance vie",
  livret: "Livret",
  immo: "Immobilier",
  crypto: "Crypto",
  cash: "Cash",
  autre: "Autre",
  credit: "Crédit",
};

export const TARGET_ALLOCATIONS: Record<
  RiskProfile,
  { actions: number; obligations: number; immo: number; cash: number }
> = {
  prudent: { actions: 25, obligations: 50, immo: 15, cash: 10 },
  equilibre: { actions: 50, obligations: 30, immo: 15, cash: 5 },
  dynamique: { actions: 70, obligations: 10, immo: 15, cash: 5 },
  offensif: { actions: 85, obligations: 5, immo: 10, cash: 0 },
};

export const RISK_LABELS: Record<RiskProfile, string> = {
  prudent: "Prudent",
  equilibre: "Équilibré",
  dynamique: "Dynamique",
  offensif: "Offensif",
};
