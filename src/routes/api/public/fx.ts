import { createFileRoute } from "@tanstack/react-router";
import { forbidden, isAllowedOrigin } from "./_guard";

/**
 * Taux de change de référence de la Banque centrale européenne.
 *
 * Source officielle, gratuite, sans clé : un flux XML publié une fois par
 * jour ouvré vers 16 h CET. Les taux sont exprimés pour 1 EUR
 * (par exemple USD = 1,09 signifie 1 € = 1,09 $).
 */

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export interface FxRates {
  /** Date de publication (AAAA-MM-JJ). */
  date: string;
  /** Devise → unités pour 1 EUR. EUR vaut toujours 1. */
  rates: Record<string, number>;
}

export const Route = createFileRoute("/api/public/fx")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!isAllowedOrigin(request)) return forbidden();
        try {
          const res = await fetch(ECB_URL, {
            headers: { Accept: "application/xml" },
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) return Response.json({ date: "", rates: {} } satisfies FxRates);

          const xml = await res.text();
          const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1] ?? "";
          const rates: Record<string, number> = { EUR: 1 };
          const re = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(xml))) {
            const value = Number(m[2]);
            if (m[1] && Number.isFinite(value) && value > 0) rates[m[1]] = value;
          }

          return Response.json({ date, rates } satisfies FxRates, {
            // Le flux ne change qu'une fois par jour : inutile d'interroger
            // la BCE à chaque ouverture de l'app.
            headers: {
              "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
            },
          });
        } catch {
          return Response.json({ date: "", rates: {} } satisfies FxRates);
        }
      },
    },
  },
});
