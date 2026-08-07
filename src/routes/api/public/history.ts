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
  /** Renseigné quand le ticker fourni était introuvable et a été remplacé. */
  resolvedFrom?: string;
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

        // Certains ETF européens ne repondent pas à la combinaison
        // « range=max, interval=1mo » alors qu'ils renvoient bien un
        // historique sur une plage bornée. On essaie donc plusieurs
        // combinaisons avant de conclure à une absence de données.
        const attempts = [
          "interval=1mo&range=max",
          "interval=1mo&range=10y",
          "interval=1wk&range=10y",
          "interval=1d&range=5y",
        ];

        for (const query of attempts) {
          const points = await tryFetch(symbol, query);
          if (points.length >= 24) {
            return Response.json({ symbol, points } satisfies HistoryResult, {
              // L'historique ne bouge pas dans la journée.
              headers: { "Cache-Control": "public, max-age=21600" },
            });
          }
        }

        // Le ticker saisi peut être erroné ou inconnu de la source. Dans ce
        // cas, on cherche le symbole correspondant au libellé de la ligne et
        // on retente : l'utilisateur n'a pas à deviner le bon code.
        const name = (url.searchParams.get("name") ?? "").trim().slice(0, 80);
        if (name) {
          for (const candidate of await resolveSymbols(name)) {
            if (candidate === symbol) continue;
            for (const query of attempts.slice(0, 2)) {
              const points = await tryFetch(candidate, query);
              if (points.length >= 24) {
                return Response.json(
                  { symbol: candidate, points, resolvedFrom: symbol } satisfies HistoryResult,
                  { headers: { "Cache-Control": "public, max-age=21600" } },
                );
              }
            }
          }
        }

        return Response.json({ symbol, points: [] } satisfies HistoryResult);
      },
    },
  },
});

/** Une tentative de récupération ; renvoie une liste vide en cas d'échec. */
async function tryFetch(symbol: string, query: string): Promise<HistoryPoint[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        // Sans délai d'expiration, une réponse qui ne vient jamais
        // retiendrait la fonction jusqu'au timeout de la plateforme.
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];

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

    const raw: HistoryPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      const t = ts[i];
      if (typeof c === "number" && c > 0 && typeof t === "number") raw.push({ t: t * 1000, c });
    }

    // Les mesures attendent un point par mois : on ne garde que le
    // dernier cours de chaque mois quand le pas est plus fin.
    if (/interval=1(wk|d)/.test(query)) return toMonthly(raw);
    return raw;
  } catch {
    return [];
  }
}

function toMonthly(points: HistoryPoint[]): HistoryPoint[] {
  const byMonth = new Map<string, HistoryPoint>();
  for (const p of points) {
    byMonth.set(new Date(p.t).toISOString().slice(0, 7), p);
  }
  return [...byMonth.values()].sort((a, b) => a.t - b.t);
}

/** Symboles candidats pour un libellé, via la recherche de la source. */
async function resolveSymbols(name: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=6&newsCount=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { quotes?: Array<{ symbol?: string }> };
    const symbols = (data.quotes ?? [])
      .map((q) => q.symbol)
      .filter((sy): sy is string => typeof sy === "string");
    // Les places européennes d'abord : une ligne de PEA y est cotée.
    return [...symbols.filter((sy) => /\.(PA|AS|DE|MI|L)$/i.test(sy)), ...symbols].slice(0, 4);
  } catch {
    return [];
  }
}
