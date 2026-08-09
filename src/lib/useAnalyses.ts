import { useEffect, useMemo, useState } from "react";
import { analyze, type Analysis } from "./signals";
import type { HistoryResult } from "@/routes/api/public/history";
import { benchmarkFor } from "./classify";
import type { Asset, RiskProfile } from "./types";

/** Marché de référence pour le calcul de l'alpha : actions monde. */
/** Indice par défaut ; chaque ligne peut en réclamer un plus adapté. */
const BENCHMARK = "URTH";

/**
 * Analyse les lignes cotées du portefeuille. Un seul chargement par
 * montage, l'historique étant mis en cache six heures côté serveur.
 * La clé de la Map est l'identifiant de la ligne.
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

    const load = async (symbol: string, name?: string): Promise<HistoryResult | null> => {
      try {
        const q = new URLSearchParams({ symbol });
        // Le libellé sert de repli quand le ticker saisi est introuvable.
        if (name) q.set("name", name);
        const res = await fetch(`/api/public/history?${q.toString()}`);
        return res.ok ? ((await res.json()) as HistoryResult) : null;
      } catch {
        return null;
      }
    };

    void (async () => {
      const bench = await load(BENCHMARK);
      const results = await Promise.all(
        tracked.map(async (asset) => {
          const data = await load(
            String(asset.data["ticker"]),
            String(asset.data["name"] ?? ""),
          );
          // Un fonds émergent se juge face aux émergents : le comparer à
          // un indice mondial mesurerait l'écart entre deux marchés
          // plutôt que la qualité du fonds.
          const own = benchmarkFor(`${asset.data["name"] ?? ""} ${asset.data["ticker"] ?? ""}`);
          const ownBench = own.symbol === BENCHMARK ? bench : await load(own.symbol);
          if (!data?.points?.length) return null;
          const a = analyze(String(asset.data["ticker"]), data.points, risk, (ownBench ?? bench)?.points);
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
