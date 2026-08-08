import { createFileRoute } from "@tanstack/react-router";
import { forbidden, isAllowedOrigin } from "./_guard";

/**
 * Composition sectorielle réelle d'un fonds ou d'un ETF.
 *
 * Remplace les répartitions approchées par les pondérations publiées.
 * Les clés renvoyées par la source sont normalisées vers les libellés de
 * l'application. En cas d'échec — module absent, valeur non cotée,
 * accès refusé — la réponse est vide et l'app retombe sur son estimation
 * par indice, sans jamais bloquer l'écran.
 */

export interface HoldingsResult {
  symbol: string;
  /** Secteur → part, sommant à 1. Vide si la source ne renseigne rien. */
  sectors: Record<string, number>;
}

/** Correspondance entre les clés de la source et les secteurs de l'app. */
const SECTOR_MAP: Record<string, string> = {
  technology: "Technologie",
  // Les grandes valeurs de communication des indices sont des sociétés
  // technologiques ; les regrouper évite un secteur résiduel trompeur.
  communication_services: "Technologie",
  financial_services: "Finance",
  healthcare: "Santé",
  consumer_cyclical: "Consommation",
  consumer_defensive: "Consommation",
  industrials: "Industrie",
  energy: "Énergie",
  basic_materials: "Matériaux",
  utilities: "Services publics",
  realestate: "Immobilier",
};

export const Route = createFileRoute("/api/public/holdings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();

        const url = new URL(request.url);
        const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol)) {
          return Response.json({ symbol, sectors: {} } satisfies HoldingsResult);
        }

        try {
          const res = await fetch(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=topHoldings`,
            {
              headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
              signal: AbortSignal.timeout(8000),
            },
          );
          if (!res.ok) return Response.json({ symbol, sectors: {} } satisfies HoldingsResult);

          const data = (await res.json()) as {
            quoteSummary?: {
              result?: Array<{
                topHoldings?: {
                  sectorWeightings?: Array<Record<string, { raw?: number } | number>>;
                };
              }>;
            };
          };

          const raw = data.quoteSummary?.result?.[0]?.topHoldings?.sectorWeightings ?? [];
          const sectors: Record<string, number> = {};
          for (const entry of raw) {
            for (const [key, value] of Object.entries(entry)) {
              const weight = typeof value === "number" ? value : (value?.raw ?? 0);
              const label = SECTOR_MAP[key];
              if (label && weight > 0) sectors[label] = (sectors[label] ?? 0) + weight;
            }
          }

          // Normalisation : la source publie parfois des sommes légèrement
          // inférieures à un, les positions résiduelles n'étant pas classées.
          const total = Object.values(sectors).reduce((s, v) => s + v, 0);
          const normalized =
            total > 0
              ? Object.fromEntries(Object.entries(sectors).map(([k, v]) => [k, v / total]))
              : {};

          return Response.json({ symbol, sectors: normalized } satisfies HoldingsResult, {
            // Une composition sectorielle ne bouge pas dans la journée.
            headers: { "Cache-Control": "public, max-age=86400" },
          });
        } catch {
          return Response.json({ symbol, sectors: {} } satisfies HoldingsResult);
        }
      },
    },
  },
});
