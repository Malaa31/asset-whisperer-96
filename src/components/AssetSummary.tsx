import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { allocationByType } from "@/lib/calc";
import { eur, rawPct } from "@/lib/format";
import { TYPE_LABELS, type Asset, type AssetType } from "@/lib/types";

const TYPE_COLORS: Record<AssetType, string> = {
  pea: "#007AFF",
  av: "#AF52DE",
  livret: "#FFCC00",
  immo: "#FF9500",
  crypto: "#5856D6",
  cash: "#5AC8FA",
  autre: "#8E8E93",
  credit: "#FF3B30",
};

/**
 * Synthèse sur l'accueil : une barre empilée et les trois premières
 * classes. Le détail complet (camembert, régions, score) vit dans Actifs.
 */
export function AssetSummary({ assets }: { assets: Asset[] }) {
  const alloc = useMemo(() => allocationByType(assets), [assets]);
  const total = alloc.reduce((s, x) => s + x.value, 0);

  if (!alloc.length || total <= 0) {
    return (
      <Link
        to="/patrimoine"
        className="tap card-surface mt-4 flex items-center justify-between p-4"
      >
        <span className="text-sm font-semibold">Ajoute tes premières lignes</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    );
  }

  const top = alloc.slice(0, 3);
  const rest = alloc.slice(3);
  const restValue = rest.reduce((s, x) => s + x.value, 0);

  return (
    <Link to="/patrimoine" className="tap card-surface mt-4 block p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Synthèse des actifs</span>
        <span className="flex items-center gap-1 num text-xs text-muted-foreground">
          {eur(total)}
          <ChevronRight className="size-4" />
        </span>
      </div>

      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {alloc.map((x) => (
          <span
            key={x.type}
            style={{
              width: `${(x.value / total) * 100}%`,
              backgroundColor: TYPE_COLORS[x.type],
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {top.map((x) => (
          <li key={x.type} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[x.type] }}
              />
              <span className="truncate">{TYPE_LABELS[x.type]}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="num">{eur(x.value)}</span>
              <span className="w-9 text-right num text-[11px] text-muted-foreground">
                {rawPct((x.value / total) * 100, 0)}
              </span>
            </span>
          </li>
        ))}
        {rest.length > 0 && (
          <li className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-muted-foreground/40" />
              {rest.length} autre{rest.length > 1 ? "s" : ""}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="num">{eur(restValue)}</span>
              <span className="w-9 text-right num text-[11px]">
                {rawPct((restValue / total) * 100, 0)}
              </span>
            </span>
          </li>
        )}
      </ul>
    </Link>
  );
}
