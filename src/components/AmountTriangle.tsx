import { RefreshCw } from "lucide-react";
import { eur } from "@/lib/format";

/**
 * Trio quantité · prix unitaire · montant total.
 *
 * Deux valeurs sur trois suffisent : la troisième se calcule toute seule.
 * On mémorise l'ordre de saisie pour savoir laquelle recalculer — c'est
 * toujours la valeur la plus anciennement renseignée qui cède.
 */

export type TriangleKey = "quantity" | "price" | "total";

const parse = (v: string): number => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Arrondi d'affichage : 2 décimales pour l'argent, 6 pour les quantités. */
const fmt = (v: number, key: TriangleKey): string => {
  if (!Number.isFinite(v) || v <= 0) return "";
  const rounded = key === "quantity" ? Math.round(v * 1e6) / 1e6 : Math.round(v * 100) / 100;
  return String(rounded);
};

/**
 * Recalcule le champ manquant après une saisie.
 * `edited` est le champ qui vient d'être modifié, `order` la liste des
 * champs déjà renseignés du plus ancien au plus récent.
 */
export function solveTriangle(
  values: Record<TriangleKey, string>,
  edited: TriangleKey,
  order: TriangleKey[],
): Record<TriangleKey, string> {
  const q = parse(values.quantity);
  const p = parse(values.price);
  const t = parse(values.total);
  const filled = (["quantity", "price", "total"] as TriangleKey[]).filter(
    (k) => parse(values[k]) > 0,
  );

  // Il faut deux valeurs pour en déduire une troisième.
  if (filled.length < 2) return values;

  // Cible : le champ le plus anciennement saisi parmi ceux qui ne viennent
  // pas d'être modifiés. À défaut, le champ vide.
  const others = (["quantity", "price", "total"] as TriangleKey[]).filter((k) => k !== edited);
  const empty = others.find((k) => parse(values[k]) <= 0);
  const target =
    empty ?? others.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  if (!target) return values;

  const out = { ...values };
  if (target === "total" && q > 0 && p > 0) out.total = fmt(q * p, "total");
  else if (target === "price" && q > 0 && t > 0) out.price = fmt(t / q, "price");
  else if (target === "quantity" && p > 0 && t > 0) out.quantity = fmt(t / p, "quantity");
  return out;
}

export function AmountTriangle({
  values,
  onChange,
  priceLabel,
  quantityLabel = "Quantité",
  marketPrice,
  onFetchPrice,
  fetching,
}: {
  values: Record<TriangleKey, string>;
  onChange: (next: Record<TriangleKey, string>, edited: TriangleKey) => void;
  priceLabel: string;
  quantityLabel?: string;
  /** Cours du marché proposé, si connu. */
  marketPrice?: number | undefined;
  onFetchPrice?: (() => void) | undefined;
  fetching?: boolean;
}) {
  const set = (key: TriangleKey, v: string) => onChange({ ...values, [key]: v }, key);
  const priceDiffers =
    marketPrice !== undefined &&
    marketPrice > 0 &&
    Math.abs(parse(values.price) - marketPrice) > 0.005;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="grid grid-cols-2 gap-2">
        <Cell label={quantityLabel} value={values.quantity} onChange={(v) => set("quantity", v)} />
        <Cell label={priceLabel} value={values.price} onChange={(v) => set("price", v)} />
      </div>
      <div className="mt-2">
        <Cell
          label="Montant total (€)"
          value={values.total}
          onChange={(v) => set("total", v)}
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Renseigne deux valeurs, la troisième se calcule.
      </p>

      {marketPrice !== undefined && marketPrice > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-elevated px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            Cours du jour : <span className="num text-foreground">{eur(marketPrice, 2)}</span>
          </span>
          {priceDiffers && (
            <button
              type="button"
              onClick={() => set("price", fmt(marketPrice, "price"))}
              className="tap shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground"
            >
              Utiliser
            </button>
          )}
        </div>
      )}

      {onFetchPrice && (
        <button
          type="button"
          onClick={onFetchPrice}
          disabled={fetching}
          className="tap mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2 text-xs font-semibold text-primary disabled:opacity-40"
        >
          <RefreshCw className={`size-3.5 ${fetching ? "animate-spin" : ""}`} />
          Récupérer le cours
        </button>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 num text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
