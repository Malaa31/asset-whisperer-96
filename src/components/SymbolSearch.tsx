import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, ChevronRight } from "lucide-react";
import { searchCatalog, type CatalogEntry } from "@/lib/catalog";
import { fetchQuote, searchSymbols } from "@/lib/market";
import { num } from "@/lib/format";

export interface SelectedSymbol extends CatalogEntry {
  price?: number | undefined;
}

export function SymbolSearch({
  kind = "titre",
  onSelect,
  onManual,
}: {
  kind?: "titre" | "crypto";
  onSelect: (entry: SelectedSymbol) => void;
  onManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const local = useMemo(() => searchCatalog(query, kind), [query, kind]);
  const results = useMemo(() => {
    const seen = new Set(local.map((l) => l.ticker));
    return [...local, ...remote.filter((r) => !seen.has(r.ticker))].slice(0, 10);
  }, [local, remote]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const hits = await searchSymbols(q);
      if (cancelled) return;
      setRemote(
        hits.map((h) => ({
          name: h.name,
          ticker: h.symbol,
          region: h.exchange || "Monde",
          sector: h.type || "Titre",
          currency: "EUR",
          kind: "etf" as const,
        })),
      );
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setLoading(false);
    };
  }, [query]);

  useEffect(() => {
    const missing = results.map((r) => r.ticker).filter((t) => !(t in prices));
    if (!missing.length) return;
    let cancelled = false;
    fetchQuote(missing.slice(0, 8)).then((q) => {
      if (cancelled) return;
      setPrices((p) => {
        const next = { ...p };
        for (const [k, v] of Object.entries(q)) next[k] = v.price;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const choose = async (entry: CatalogEntry) => {
    const known = prices[entry.ticker];
    if (known !== undefined) {
      onSelect({ ...entry, price: known });
      return;
    }
    const q = await fetchQuote([entry.ticker]);
    onSelect({ ...entry, price: q[entry.ticker]?.price });
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              void choose(results[active]);
            }
          }}
          placeholder={kind === "crypto" ? "Bitcoin, ETH…" : "World, S&P 500, Nvidia, ISIN…"}
          className="h-12 w-full rounded-xl border border-border bg-elevated pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {results.map((r, i) => (
          <li key={r.ticker + i}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => void choose(r)}
              className={`tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                i === active ? "border-primary/60 bg-elevated" : "border-transparent bg-card"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{r.name}</span>
                  {r.pea && (
                    <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      PEA
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {r.ticker} · {r.region} · {r.sector}
                </div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs">
                {prices[r.ticker] !== undefined ? (
                  <span>{num(prices[r.ticker]!)} €</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </button>
          </li>
        ))}
        {!results.length && !loading && (
          <li className="px-1 py-4 text-center text-sm text-muted-foreground">Aucun résultat</li>
        )}
      </ul>

      <button
        type="button"
        onClick={onManual}
        className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground"
      >
        Je ne trouve pas → saisie manuelle
        <ChevronRight className="size-3" />
      </button>
    </div>
  );
}
