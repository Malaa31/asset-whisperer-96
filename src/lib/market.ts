export interface SymbolHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface Quote {
  price: number;
  currency: string;
  prevClose: number;
  changePct: number;
}

export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  try {
    const res = await fetch(`/api/public/search-symbols?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return (await res.json()) as SymbolHit[];
  } catch {
    return [];
  }
}

export async function fetchQuote(tickers: string[]): Promise<Record<string, Quote>> {
  const list = Array.from(new Set(tickers.filter(Boolean)));
  if (!list.length) return {};
  try {
    const res = await fetch(`/api/public/quote?symbols=${encodeURIComponent(list.join(","))}`);
    if (!res.ok) return {};
    return (await res.json()) as Record<string, Quote>;
  } catch {
    return {};
  }
}
