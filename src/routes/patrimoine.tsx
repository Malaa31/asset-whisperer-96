import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ChevronRight, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { QuickUpdate } from "@/components/QuickUpdate";
import { useApp } from "@/lib/storage";
import { assetValue, assetGain, totals, n } from "@/lib/calc";
import { eur, num, rawPct, signedEur } from "@/lib/format";
import { TYPE_LABELS, type Asset, type AssetType } from "@/lib/types";
import { AssetModal } from "@/components/AssetModal";
import { AllocationCard } from "@/components/AllocationCard";
import { foreignCurrencyAssets } from "@/lib/calc";
import { canConvert, fxSnapshot } from "@/lib/fx";

export const Route = createFileRoute("/patrimoine")({
  head: () => ({
    meta: [
      { title: "Patrimoine — Actifs et passifs" },
      {
        name: "description",
        content: "La liste complète de vos actifs et de vos dettes, groupée par type.",
      },
      { property: "og:title", content: "Patrimoine — Actifs et passifs" },
      {
        property: "og:description",
        content: "La liste complète de vos actifs et de vos dettes, groupée par type.",
      },
    ],
  }),
  component: Patrimoine,
});

function Patrimoine() {
  const { assets, upsertAsset, removeAsset, setAssets } = useApp();
  const [side, setSide] = useState<"actifs" | "passifs">("actifs");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [pointing, setPointing] = useState(false);
  const foreign = useMemo(() => foreignCurrencyAssets(assets), [assets]);
  const fx = fxSnapshot();
  const converted = useMemo(
    () =>
      assets.filter((a) => {
        const c = String(a.data["currency"] ?? "EUR").toUpperCase();
        return c !== "EUR" && canConvert(c);
      }),
    [assets],
  );

  const t = useMemo(() => totals(assets), [assets]);
  const list = assets.filter((a) =>
    side === "passifs" ? a.type === "credit" : a.type !== "credit",
  );
  const filtered = filter === "all" ? list : list.filter((a) => a.type === filter);
  const types = Array.from(new Set(list.map((a) => a.type)));

  const groups = types
    .filter((ty) => filter === "all" || ty === filter)
    .map((ty) => ({
      type: ty,
      items: filtered.filter((a) => a.type === ty),
    }))
    .filter((g) => g.items.length);

  return (
    <div className="fade-up px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">Patrimoine</h1>
        <button
          type="button"
          onClick={() => setPointing(true)}
          className="tap flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          <ClipboardCheck className="size-3.5" /> Pointage
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-elevated p-1">
        {(["actifs", "passifs"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setFilter("all");
            }}
            className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${
              side === s ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            <div className="capitalize">{s}</div>
            <div className={`font-mono text-sm ${s === "passifs" ? "text-destructive" : ""}`}>
              {eur(s === "actifs" ? t.actifs : t.dettes)}
            </div>
          </button>
        ))}
      </div>

      {foreign.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-[11px] leading-relaxed text-muted-foreground">
          {foreign.length} ligne{foreign.length > 1 ? "s" : ""} dans une devise sans
          taux connu ({[...new Set(foreign.map((a) => String(a.data["currency"])))].join(", ")}) :
          ces montants sont comptés tels quels. Saisis la valeur en euros pour un
          patrimoine net juste.
        </div>
      )}

      {converted.length > 0 && fx?.date && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {converted.length} ligne{converted.length > 1 ? "s" : ""} convertie
          {converted.length > 1 ? "s" : ""} en euros au taux BCE du{" "}
          {new Date(fx.date).toLocaleDateString("fr-FR")}.
        </p>
      )}

      {side === "actifs" && <AllocationCard assets={assets} />}

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {(["all", ...types] as const).map((ty) => (
          <button
            key={ty}
            type="button"
            onClick={() => setFilter(ty as AssetType | "all")}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              filter === ty
                ? "border-primary bg-primary/12 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {ty === "all" ? "Tout" : TYPE_LABELS[ty as AssetType]}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {groups.map((g) => {
          const sub = g.items.reduce((s, a) => s + Math.abs(assetValue(a)), 0);
          return (
            <section key={g.type}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{TYPE_LABELS[g.type]}</h2>
                <span className="font-mono text-xs text-muted-foreground">{eur(sub)}</span>
              </div>
              <div className="space-y-2">
                {g.items.map((a) => (
                  <AssetRow key={a.id} asset={a} onOpen={() => setEditing(a)} />
                ))}
              </div>
            </section>
          );
        })}
        {!groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune ligne pour l'instant.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="tap mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold"
      >
        <Plus className="size-4" /> Ajouter
      </button>

      {(editing || creating) && (
        <AssetModal
          asset={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(a) => {
            upsertAsset(a);
            setEditing(null);
            setCreating(false);
            toast.success(editing ? "Ligne enregistrée" : "Ligne ajoutée");
          }}
          onDelete={(id) => {
            removeAsset(id);
            setEditing(null);
          }}
        />
      )}
      {pointing && (
        <QuickUpdate
          assets={assets}
          onClose={() => setPointing(false)}
          onSave={(next) => {
            setAssets(next);
            setPointing(false);
            toast.success("Montants mis à jour");
          }}
        />
      )}
    </div>
  );
}

function AssetRow({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const value = assetValue(asset);
  const gain = assetGain(asset);
  const d = asset.data;
  let tags: string[] = [];

  if (asset.type === "pea") {
    if (d["envelope"]) tags.push(String(d["envelope"]));
    tags.push(`${num(n(d["quantity"]), 0)} × ${num(n(d["currentPrice"]) || n(d["pru"]))} €`);
  } else if (asset.type === "av") {
    if (d["dateOuverture"]) tags.push(`ouvert ${d["dateOuverture"]}`);
    tags.push(`Fonds € ${eur(n(d["fondsEurosAmount"]))}`);
  } else if (asset.type === "livret") {
    if (d["taux"]) tags.push(`${num(n(d["taux"]))} %`);
  } else if (asset.type === "crypto") {
    tags.push(`${num(n(d["quantity"]), 4)} × ${num(n(d["prixUnitaire"]))} €`);
  } else if (asset.type === "credit") {
    tags.push(`${eur(n(d["mensualite"]))}/mois`);
    if (d["taux"]) tags.push(`${num(n(d["taux"]))} %`);
  } else if (asset.type === "immo" && d["loyer"]) {
    tags.push(`loyer ${eur(n(d["loyer"]))}`);
  }

  tags = tags.slice(0, 1);

  const rembourse =
    asset.type === "credit" && n(d["capitalInitial"])
      ? ((n(d["capitalInitial"]) - n(d["capitalRestant"])) / n(d["capitalInitial"])) * 100
      : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap card-surface flex w-full flex-col gap-2 px-4 py-3 text-left"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {String(d["name"] ?? d["type"] ?? d["ticker"] ?? "Ligne")}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {tags.join(" · ")}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-sm ${asset.type === "credit" ? "text-destructive" : ""}`}
          >
            {eur(Math.abs(value))}
          </div>
          {gain !== 0 && (
            <div
              className={`font-mono text-[11px] ${gain >= 0 ? "text-primary" : "text-destructive"}`}
            >
              {signedEur(gain)}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {rembourse !== null && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, rembourse))}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {rawPct(rembourse)} remboursé
          </div>
        </div>
      )}
    </button>
  );
}
