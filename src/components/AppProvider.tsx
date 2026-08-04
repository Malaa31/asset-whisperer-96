import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AppContext,
  KEYS,
  storage,
  type AppState,
  type HistoryPoint,
} from "@/lib/storage";
import { totals } from "@/lib/calc";
import { setAmountMasking } from "@/lib/format";
import { toast } from "sonner";
import { ensureFxRates } from "@/lib/fx";
import { REMINDER_SEEN_KEY } from "@/lib/reminder";
import type { Asset, Profile } from "@/lib/types";

/** Une seule alerte par session : inutile de harceler à chaque frappe. */
let storageWarned = false;
function warnStorageFull() {
  if (storageWarned) return;
  storageWarned = true;
  toast.error("Enregistrement impossible", {
    description:
      "Le stockage du navigateur est plein ou indisponible. Exporte une sauvegarde depuis Profil avant de fermer l'app.",
    duration: 10000,
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  // Force un recalcul une fois les taux du jour récupérés.
  const [fxTick, setFxTick] = useState(0);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    const p = storage.get<Profile>(KEYS.profile);
    const a = storage.get<Asset[]>(KEYS.assets);
    // Taux de change : rafraîchis en arrière-plan, les derniers connus
    // servent en attendant (et hors ligne).
    void ensureFxRates().then(() => setFxTick((t) => t + 1));
    setProfile(p);
    setAmountMasking(Boolean(p?.hideAmounts));
    setAssetsState(a ?? []);
    setHistory(storage.get<HistoryPoint[]>(KEYS.history) ?? []);
    setReady(true);
  }, []);

  const persist = useCallback((next: Asset[]) => {
    setAssetsState(next);
    if (!storage.set(KEYS.assets, next)) warnStorageFull();
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
        if (!storage.set(KEYS.profile, p)) warnStorageFull();
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
        storage.remove(KEYS.history);
        storage.remove(REMINDER_SEEN_KEY);
        setHistory([]);
        setProfile(null);
        setAssetsState([]);
      },
    }),
    [profile, assets, ready, history, persist, fxTick],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
