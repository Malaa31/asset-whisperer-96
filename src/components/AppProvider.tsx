import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AppContext,
  KEYS,
  seedAssets,
  storage,
  type AppState,
  type HistoryPoint,
} from "@/lib/storage";
import { totals } from "@/lib/calc";
import { setAmountMasking } from "@/lib/format";
import type { Asset, Profile } from "@/lib/types";

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    const p = storage.get<Profile>(KEYS.profile);
    let a = storage.get<Asset[]>(KEYS.assets);
    if (!a || a.length === 0) {
      if (!storage.get<boolean>(KEYS.seeded)) {
        a = seedAssets();
        storage.set(KEYS.assets, a);
        storage.set(KEYS.seeded, true);
      }
    }
    setProfile(p);
    setAmountMasking(Boolean(p?.hideAmounts));
    setAssetsState(a ?? []);
    setHistory(storage.get<HistoryPoint[]>(KEYS.history) ?? []);
    setReady(true);
  }, []);

  const persist = useCallback((next: Asset[]) => {
    setAssetsState(next);
    storage.set(KEYS.assets, next);
  }, []);

  // Enregistre un point d'historique par jour pour la courbe "réel".
  useEffect(() => {
    if (!ready) return;
    const today = new Date().toISOString().slice(0, 10);
    const net = totals(assets).net;
    setHistory((prev) => {
      const rest = prev.filter((h) => h.date.slice(0, 10) !== today);
      const next = [...rest, { date: new Date().toISOString(), value: net }].slice(-60);
      storage.set(KEYS.history, next);
      return next;
    });
  }, [assets, ready]);

  const value = useMemo<AppState>(
    () => ({
      profile,
      assets,
      ready,
      history,
      saveProfile: (p) => {
        setProfile(p);
        setAmountMasking(Boolean(p.hideAmounts));
        storage.set(KEYS.profile, p);
      },
      upsertAsset: (a) => {
        const exists = assets.some((x) => x.id === a.id);
        persist(exists ? assets.map((x) => (x.id === a.id ? a : x)) : [...assets, a]);
      },
      removeAsset: (id) => persist(assets.filter((x) => x.id !== id)),
      setAssets: persist,
      reset: () => {
        setAmountMasking(false);
        storage.remove(KEYS.profile);
        storage.remove(KEYS.assets);
        storage.remove(KEYS.seeded);
        storage.remove(KEYS.history);
        setHistory([]);
        setProfile(null);
        setAssetsState([]);
      },
    }),
    [profile, assets, ready, history, persist],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
