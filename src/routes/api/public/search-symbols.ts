import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/search-symbols")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q) return Response.json([]);
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
