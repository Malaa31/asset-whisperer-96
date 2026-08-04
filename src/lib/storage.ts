import { createContext, useContext } from "react";
import type { Asset, Profile } from "./types";

const KEY_PROFILE = "patrimoine.profile";
const KEY_ASSETS = "patrimoine.assets";
const KEY_SEED = "patrimoine.seeded";
const KEY_HISTORY = "patrimoine.history";

export const storage = {
  get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

export const KEYS = {
  profile: KEY_PROFILE,
  assets: KEY_ASSETS,
  seeded: KEY_SEED,
  history: KEY_HISTORY,
};

export interface HistoryPoint {
  date: string;
  value: number;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const now = () => new Date().toISOString();

export function seedAssets(): Asset[] {
  const rows = [
    {
      name: "Amundi PEA Émergent ESG Transition",
      ticker: "PAEEM.PA",
      isin: "LU2300295199",
      quantity: 70,
      pru: 26.51,
      currentPrice: 35.58,
      region: "Émergents",
      sector: "ETF actions émergents",
    },
    {
      name: "Amundi PEA Monde MSCI World Acc",
      ticker: "PCEW.PA",
      isin: "LU2089238385",
      quantity: 1229,
      pru: 5.65,
      currentPrice: 5.97,
      region: "Monde",
      sector: "ETF diversifié",
    },
    {
      name: "Amundi PEA S&P 500 Acc",
      ticker: "PE500.PA",
      isin: "FR0013412020",
      quantity: 88,
      pru: 48.48,
      currentPrice: 56.76,
      region: "États-Unis",
      sector: "ETF actions US",
    },
    {
      name: "BNP Easy Stoxx Europe 600 Cap.",
      ticker: "BNL.PA",
      isin: "FR0011550193",
      quantity: 168,
      pru: 20.06,
      currentPrice: 20.49,
      region: "Europe",
      sector: "ETF actions Europe",
    },
  ];
  return rows.map((r) => ({
    id: uid(),
    type: "pea" as const,
    data: { envelope: "PEA", currency: "EUR", ...r },
    createdAt: now(),
    updatedAt: now(),
  }));
}

export interface AppState {
  profile: Profile | null;
  assets: Asset[];
  ready: boolean;
  saveProfile: (p: Profile) => void;
  upsertAsset: (a: Asset) => void;
  removeAsset: (id: string) => void;
  setAssets: (a: Asset[]) => void;
  history: HistoryPoint[];
  reset: () => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
