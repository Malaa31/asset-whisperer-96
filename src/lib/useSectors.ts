import { useEffect, useMemo, useState } from "react";
import type { HoldingsResult } from "@/routes/api/public/holdings";
import type { Sector } from "./classify";
import type { Asset } from "./types";

/**
 * Compositions sectorielles publiées, indexées par ticker.
 *
 * Chargées une fois par montage et mises en cache une journée côté
 * serveur. Un support sans composition disponible reste simplement
 * absent de la table : l'app retombe alors sur son estimation par
 * indice, sans que rien ne bloque.
 */
export function useSectors(assets: Asset[]) {
  const [sectors, setSectors] = useState<Map<string, Partial<Record<Sector, number>>>>(new Map());

  const tickers = useMemo(
    () =>
      [
        ...new Set(
          assets
            .filter((a) => a.type === "pea" || a.type === "crypto")
            .map((a) => String(a.data["ticker"] ?? "").trim().toUpperCase())
            .filter(Boolean),
        ),
      ].sort(),
    [assets],
  );
  const key = tickers.join("|");

  useEffect(() => {
    if (!tickers.length) {
      setSectors(new Map());
      return;
    }
    let cancelled = false;

    void Promise.all(
      tickers.map(async (t) => {
        try {
          const res = await fetch(`/api/public/holdings?symbol=${encodeURIComponent(t)}`);
          if (!res.ok) return null;
          const data = (await res.json()) as HoldingsResult;
          return Object.keys(data.sectors ?? {}).length
            ? ([t, data.sectors as Partial<Record<Sector, number>>] as const)
            : null;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setSectors(
        new Map(entries.filter((e): e is readonly [string, Partial<Record<Sector, number>>] => e !== null)),
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return sectors;
}
