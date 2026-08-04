import { createFileRoute } from "@tanstack/react-router";
import { forbidden, isAllowedOrigin } from "./_guard";

export const Route = createFileRoute("/api/public/search-symbols")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();
        const url = new URL(request.url);
        // Bornée : une requête utile fait quelques caractères, et une
        // chaîne géante ne ferait que charger l'amont pour rien.
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
        if (q.length < 2) return Response.json([]);
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
            {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        // Sans délai d'expiration, une réponse qui ne vient jamais retient
        // la fonction serveur jusqu'au timeout de la plateforme.
        signal: AbortSignal.timeout(6000),
      },
          );
          if (!res.ok) return Response.json([]);
          const json = (await res.json()) as {
            quotes?: Array<Record<string, string>>;
          };
          const items = (json.quotes ?? [])
            .filter((it) => it["symbol"])
            .map((it) => ({
              symbol: it["symbol"] as string,
              name: (it["shortname"] ?? it["longname"] ?? it["symbol"]) as string,
              exchange: (it["exchDisp"] ?? "") as string,
              type: (it["quoteType"] ?? "") as string,
            }));
          return Response.json(items);
        } catch {
          return Response.json([]);
        }
      },
    },
  },
});
