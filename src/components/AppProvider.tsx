import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppContext, KEYS, storage, type AppState, type HistoryPoint } from "@/lib/storage";
import { totals } from "@/lib/calc";
import { compactHistory } from "@/lib/history";
import { pricesAreStale, refreshPrices } from "@/lib/prices";
import { setAmountMasking } from "@/lib/format";
import type { Asset, Profile } from "@/lib/types";
import type { BackupFile } from "@/lib/backup";
import { VaultProvider } from "@/lib/vault-sync";

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [vaultReady, setVaultReady] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const handleInitialSyncDone = useCallback(() => setVaultReady(true), []);

  useEffect(() => {
    const p = storage.get<Profile>(KEYS.profile);
    const a = storage.get<Asset[]>(KEYS.assets);
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
    if (!ready || !vaultReady) return;
    const timestamp = new Date().toISOString();
    const today = timestamp.slice(0, 10);
    const net = totals(assets).net;
    setHistory((prev) => {
      const todayPoints = prev.filter((point) => point.date.slice(0, 10) === today);
      const latestToday = todayPoints
        .slice()
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
        .at(-1);
      const nextPoints =
        latestToday && latestToday.value === net
          ? prev
          : [
              ...prev.filter((point) => point.date.slice(0, 10) !== today),
              { date: timestamp, value: net },
            ];
      const next = compactHistory(nextPoints);
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
      storage.set(KEYS.history, next);
      return next;
    });
  }, [assets, ready, vaultReady]);

  // Cours rafraîchis en arrière-plan à l'ouverture, si les derniers
  // relevés datent de plus de quatre heures. Silencieux et sans blocage :
  // un échec laisse simplement les cours précédents en place.
  useEffect(() => {
    if (!ready || !vaultReady || !pricesAreStale(assets)) return;
    let cancelled = false;
    void refreshPrices(assets).then((next) => {
      if (next && !cancelled) persist(next);
    });
    return () => {
      cancelled = true;
    };
    // Une seule tentative par montage : `assets` change après la mise à jour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, vaultReady]);

  const backup = useMemo<BackupFile>(
    () => ({
      app: "patrimoine",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      assets,
      history,
    }),
    [profile, assets, history],
  );

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
      replaceBackup: (backup: BackupFile) => {
        if (backup.profile) storage.set(KEYS.profile, backup.profile);
        else storage.remove(KEYS.profile);
        storage.set(KEYS.assets, backup.assets);
        storage.set(KEYS.history, backup.history);
        setProfile(backup.profile);
        setAmountMasking(Boolean(backup.profile?.hideAmounts));
        setAssetsState(backup.assets);
        setHistory(backup.history);
      },
      reset: () => {
        setAmountMasking(false);
        storage.remove(KEYS.profile);
        storage.remove(KEYS.assets);
        storage.remove(KEYS.history);
        setHistory([]);
        setProfile(null);
        setAssetsState([]);
      },
    }),
    [profile, assets, ready, history, persist],
  );

  return (
    <AppContext.Provider value={value}>
      <VaultProvider
        ready={ready}
        backup={backup}
        applyBackup={value.replaceBackup}
        onInitialSyncDone={handleInitialSyncDone}
      >
        {children}
      </VaultProvider>
    </AppContext.Provider>
  );
}
