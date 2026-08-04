import { createContext, useContext } from "react";
import type { Asset, Profile } from "./types";

const KEY_PROFILE = "patrimoine.profile";
const KEY_ASSETS = "patrimoine.assets";
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
  /**
   * Écrit dans le stockage local. Retourne false si l'écriture échoue
   * (quota dépassé, mode privé) : sans cela, une sauvegarde perdue
   * passait totalement inaperçue.
   */
  set(key: string, value: unknown): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

export const KEYS = {
  profile: KEY_PROFILE,
  assets: KEY_ASSETS,
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

/** Demande l'ouverture du modal d'ajout, monté dans la racine. */
export const ADD_ASSET_EVENT = "patrimoine:add-asset";
export function requestAddAsset() {
  window.dispatchEvent(new Event(ADD_ASSET_EVENT));
}
