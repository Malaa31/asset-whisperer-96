import { useEffect, useMemo, useState } from "react";
import { analyze, type Analysis } from "./signals";
import type { HistoryResult } from "@/routes/api/public/history";
import type { Asset, RiskProfile } from "./types";

/** Marché de référence pour le calcul de l'alpha : actions monde. */
const BENCHMARK = "IWDA.AS";

/**
 * Analyse les lignes cotées du portefeuille.
 * Un seul chargement par montage, l'historique étant mis en cache six
 * heures côté serveur. La clé de la Map est l'identifiant de la ligne.
 */
export function useAnalyses(assets: Asset[], risk: RiskProfile) {
  const [analyses, setAnalyses] = useState<Map<string, Analysis>>(new Map());
  const [loading, setLoading] = useState(false);

  const tracked = useMemo(
    () =>
      assets.filter(
        (a) => (a.type === "pea" || a.type === "crypto") && String(a.data["ticker"] ?? "").trim(),
      ),
    [assets],
  );
  const key = tracked.map((a) => `${a.id}:${a.data["ticker"]}`).join("|");

  useEffect(() => {
    if (!tracked.length) {
      setAnalyses(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async (symbol: string): Promise<HistoryResult | null> => {
      try {
        const res = await fetch(`/api/public/history?symbol=${encodeURIComponent(symbol)}`);
        return res.ok ? ((await res.json()) as HistoryResult) : null;
      } catch {
        return null;
      }
    };

    void (async () => {
      const bench = await load(BENCHMARK);
      const results = await Promise.all(
        tracked.map(async (asset) => {
          const data = await load(String(asset.data["ticker"]));
          if (!data?.points?.length) return null;
          const a = analyze(String(asset.data["ticker"]), data.points, risk, bench?.points);
          return a ? ([asset.id, a] as const) : null;
        }),
      );
      if (cancelled) return;
      setAnalyses(new Map(results.filter((r): r is readonly [string, Analysis] => r !== null)));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, risk]);

  return { analyses, loading };
}
