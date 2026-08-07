import { RefreshCw } from "lucide-react";

/**
 * Trio quantité · prix unitaire · montant total.
 *
 * Deux valeurs sur trois suffisent : la troisième se déduit. L'ordre de
 * saisie détermine laquelle cède — c'est toujours la plus anciennement
 * renseignée, jamais celle qu'on vient de taper.
 */

export type TriangleKey = "quantity" | "price" | "total";

export interface TriangleValues {
  quantity: string;
  price: string;
  total: string;
}

const num = (v: string): number => {
  const n = Number(v.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Arrondi d'affichage : deux décimales, sans zéros inutiles. */
const fmt = (n: number): string =>
  Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : "";

/**
 * Recalcule la valeur manquante après une saisie.
 *
 * @param values  état courant des trois champs
 * @param edited  champ que l'utilisateur vient de modifier
 * @param order   champs déjà renseignés, du plus ancien au plus récent
 */
export function solveTriangle(
  values: TriangleValues,
  edited: TriangleKey,
  order: TriangleKey[],
): TriangleValues {
  const q = num(values.quantity);
  const p = num(values.price);
  const t = num(values.total);

  const filled = (["quantity", "price", "total"] as const).filter(
    (k) => num(values[k]) > 0,
  );
  // Il faut au moins deux valeurs pour en déduire une troisième.
  if (filled.length < 2) return values;

  // La valeur à recalculer : celle qui manque, ou à défaut la plus
  // anciennement saisie parmi celles que l'utilisateur n'édite pas.
  const missing = (["quantity", "price", "total"] as const).find(
    (k) => num(values[k]) <= 0,
  );
  const target =
    missing ?? order.find((k) => k !== edited) ?? filled.find((k) => k !== edited);
  if (!target || target === edited) return values;

  switch (target) {
    case "total":
      return { ...values, total: fmt(q * p) };
    case "price":
      return { ...values, price: q > 0 ? fmt(t / q) : values.price };
    case "quantity":
      return { ...values, quantity: p > 0 ? fmt(t / p) : values.quantity };
  }
}

export function AmountTriangle({
  values,
  quantityLabel,
  priceLabel,
  marketPrice,
  fetching,
  onUseMarketPrice,
  onChange,
}: {
  values: TriangleValues;
  quantityLabel: string;
  priceLabel: string;
  marketPrice?: number | undefined;
  fetching?: boolean;
  onUseMarketPrice?: (() => void) | undefined;
  onChange: (next: TriangleValues, edited: TriangleKey) => void;
}) {
  const field = (key: TriangleKey, label: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={values[key]}
        onChange={(e) => onChange({ ...values, [key]: e.target.value }, key)}
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 num text-sm outline-none focus:border-primary"
      />
    </label>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Deux valeurs suffisent : la troisième se calcule.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {field("quantity", quantityLabel)}
        {field("price", priceLabel)}
      </div>
      <div className="mt-2.5">{field("total", "Montant total (€)")}</div>

      {(marketPrice !== undefined || fetching) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {fetching ? (
              <>
                <RefreshCw className="size-3 animate-spin" /> Cours en cours de
                récupération…
              </>
            ) : (
              <>
                Cours du marché : <span className="num">{marketPrice} €</span>
              </>
            )}
          </span>
          {marketPrice !== undefined && onUseMarketPrice && (
            <button
              type="button"
              onClick={onUseMarketPrice}
              className="tap shrink-0 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary"
            >
              Utiliser
            </button>
          )}
        </div>
      )}
    </div>
  );
}
