import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppContext, KEYS, seedAssets, storage, type AppState } from "@/lib/storage";
import type { Asset, Profile } from "@/lib/types";

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);

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
    setAssetsState(a ?? []);
    setReady(true);
  }, []);

  const persist = useCallback((next: Asset[]) => {
    setAssetsState(next);
    storage.set(KEYS.assets, next);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      profile,
      assets,
      ready,
      saveProfile: (p) => {
        setProfile(p);
        storage.set(KEYS.profile, p);
      },
      upsertAsset: (a) => {
        const exists = assets.some((x) => x.id === a.id);
        persist(exists ? assets.map((x) => (x.id === a.id ? a : x)) : [...assets, a]);
      },
      removeAsset: (id) => persist(assets.filter((x) => x.id !== id)),
      setAssets: persist,
      reset: () => {
        storage.remove(KEYS.profile);
        storage.remove(KEYS.assets);
        storage.remove(KEYS.seeded);
        setProfile(null);
        setAssetsState([]);
      },
    }),
    [profile, assets, ready, persist],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
