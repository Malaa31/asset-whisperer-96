import { createFileRoute } from "@tanstack/react-router";

/**
 * Historique mensuel d'une valeur, depuis le début de sa cotation.
 * Sert à mesurer une performance lissée plutôt qu'un instantané.
 */

export interface HistoryPoint {
  /** Horodatage en millisecondes. */
  t: number;
  /** Cours de clôture ajusté. */
  c: number;
}

export interface HistoryResult {
  symbol: string;
  points: HistoryPoint[];
}

export const Route = createFileRoute("/api/public/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
        // Format Yahoo : lettres, chiffres, point, tiret, accent circonflexe.
        if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol)) {
          return Response.json({ symbol, points: [] } satisfies HistoryResult);
        }

        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=max`,
            {
              headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
              // Sans délai d'expiration, une réponse qui ne vient jamais
              // retiendrait la fonction jusqu'au timeout de la plateforme.
              signal: AbortSignal.timeout(8000),
            },
          );
          if (!res.ok) return Response.json({ symbol, points: [] } satisfies HistoryResult);

          const data = (await res.json()) as {
            chart?: {
              result?: Array<{
                timestamp?: number[];
                indicators?: {
                  adjclose?: Array<{ adjclose?: Array<number | null> }>;
                  quote?: Array<{ close?: Array<number | null> }>;
                };
              }>;
            };
          };

          const r = data.chart?.result?.[0];
          const ts = r?.timestamp ?? [];
          const closes =
            r?.indicators?.adjclose?.[0]?.adjclose ?? r?.indicators?.quote?.[0]?.close ?? [];

          const points: HistoryPoint[] = [];
          for (let i = 0; i < ts.length; i++) {
            const c = closes[i];
            const t = ts[i];
            if (typeof c === "number" && c > 0 && typeof t === "number") {
              points.push({ t: t * 1000, c });
            }
          }

          return Response.json({ symbol, points } satisfies HistoryResult, {
            // L'historique mensuel ne bouge pas dans la journée.
            headers: { "Cache-Control": "public, max-age=21600" },
          });
        } catch {
          return Response.json({ symbol, points: [] } satisfies HistoryResult);
        }
      },
    },
  },
});
