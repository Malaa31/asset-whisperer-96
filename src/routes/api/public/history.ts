import { createFileRoute } from "@tanstack/react-router";
import { forbidden, isAllowedOrigin } from "./_guard";

/**
 * Historique mensuel d'un instrument, depuis sa création si disponible.
 *
 * Sert au calcul des performances lissées et du risque : un seul appel
 * par valeur, mis en cache six heures, plutôt qu'une série de requêtes
 * à chaque ouverture de l'écran.
 */

export interface HistoryPoint {
  /** Horodatage de fin de mois (ms). */
  t: number;
  /** Cours de clôture ajusté. */
  c: number;
}

export interface HistoryResult {
  symbol: string;
  currency: string;
  points: HistoryPoint[];
}

export const Route = createFileRoute("/api/public/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();

        const url = new URL(request.url);
        const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol)) {
          return Response.json({ error: "invalid_symbol" }, { status: 400 });
        }

        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
              `?range=max&interval=1mo&events=none`,
            {
              headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
              signal: AbortSignal.timeout(8000),
            },
          );
          if (!res.ok) return Response.json({ symbol, currency: "", points: [] });

          const json = (await res.json()) as {
            chart?: {
              result?: Array<{
                meta?: { currency?: string };
                timestamp?: number[];
                indicators?: {
                  adjclose?: Array<{ adjclose?: Array<number | null> }>;
                  quote?: Array<{ close?: Array<number | null> }>;
                };
              }>;
            };
          };

          const r = json.chart?.result?.[0];
          const stamps = r?.timestamp ?? [];
          // L'ajusté intègre les dividendes : c'est la bonne base pour
          // une performance nette comparable entre capitalisant et distribuant.
          const closes =
            r?.indicators?.adjclose?.[0]?.adjclose ?? r?.indicators?.quote?.[0]?.close ?? [];

          const points: HistoryPoint[] = [];
          for (let i = 0; i < stamps.length; i++) {
            const c = closes[i];
            const t = stamps[i];
            if (typeof c === "number" && Number.isFinite(c) && c > 0 && typeof t === "number") {
              points.push({ t: t * 1000, c });
            }
          }

          return Response.json(
            { symbol, currency: r?.meta?.currency ?? "", points } satisfies HistoryResult,
            {
              headers: {
                "Cache-Control":
                  "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
              },
            },
          );
        } catch {
          return Response.json({ symbol, currency: "", points: [] });
        }
      },
    },
  },
});
