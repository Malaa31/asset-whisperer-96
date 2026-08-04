import { createFileRoute } from "@tanstack/react-router";

interface QuoteResult {
  price: number;
  currency: string;
  prevClose: number;
  changePct: number;
}

async function fetchOne(symbol: string): Promise<QuoteResult | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        // Sans délai d'expiration, une réponse qui ne vient jamais retient
        // la fonction serveur jusqu'au timeout de la plateforme.
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, number | string> }> };
    };
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = Number(meta["regularMarketPrice"]);
    const prevClose = Number(meta["chartPreviousClose"] ?? meta["previousClose"] ?? price);
    if (!Number.isFinite(price)) return null;
    return {
      price,
      currency: String(meta["currency"] ?? "EUR"),
      prevClose,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // Format Yahoo : lettres, chiffres, point, tiret, accent circonflexe.
        // Filtrer ici évite de relayer n'importe quelle chaîne vers l'amont.
        const symbols = (url.searchParams.get("symbols") ?? "")
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z0-9.^-]{1,20}$/.test(s))
          .slice(0, 25);
        const entries = await Promise.all(
          symbols.map(async (s) => [s, await fetchOne(s)] as const),
        );
        const out: Record<string, QuoteResult> = {};
        for (const [s, q] of entries) if (q) out[s] = q;
        return Response.json(out, {
          // Mutualisé au niveau du CDN : une rafale de requêtes ne
          // déclenche qu'un appel amont par minute.
          headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
        });
      },
    },
  },
});
