import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ChevronRight, ClipboardCheck, Landmark, ShieldCheck, PiggyBank, Home, Bitcoin, Banknote, Package, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { QuickUpdate } from "@/components/QuickUpdate";
import { useApp } from "@/lib/storage";
import { assetValue, assetGain, totals, n } from "@/lib/calc";
import { eur, num, rawPct, signedEur } from "@/lib/format";
import { TYPE_LABELS, type Asset, type AssetType } from "@/lib/types";
import { AssetModal } from "@/components/AssetModal";
import { AssetAnalysis } from "@/components/AssetAnalysis";

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
  const { assets, profile, upsertAsset, removeAsset, setAssets } = useApp();
  const [side, setSide] = useState<"actifs" | "passifs">("actifs");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [analyzing, setAnalyzing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [pointing, setPointing] = useState(false);

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
    <main className="fade-up flex flex-col gap-5 px-5 pb-6 pt-7">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Vue d'ensemble</p>
          <h1 className="font-display text-2xl leading-tight tracking-tight">Patrimoine</h1>
        </div>
        <button
          type="button"
          onClick={() => setPointing(true)}
          className="tap flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          <ClipboardCheck className="size-3.5" /> Pointage
        </button>
      </header>

      <section className="card-surface flex items-end justify-between gap-4 p-5">
        <div><p className="text-xs text-muted-foreground">Patrimoine net</p><p className="mt-2 font-display text-3xl tracking-tight text-primary">{eur(t.net)}</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">{side === "actifs" ? "Actifs" : "Passifs"}</p><p className="mt-2 num text-sm font-semibold">{eur(side === "actifs" ? t.actifs : t.dettes)}</p></div>
      </section>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-elevated p-1">
        {(["actifs", "passifs"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setFilter("all");
            }}
            aria-pressed={side === s}
            className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${
              side === s ? "bg-card text-primary" : "text-muted-foreground"
            }`}
          >
            <div className="capitalize">{s}</div>
            <div className={`num text-sm ${s === "passifs" ? "text-destructive" : ""}`}>
              {eur(s === "actifs" ? t.actifs : t.dettes)}
            </div>
          </button>
        ))}
      </div>


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
          const share = (sub / Math.max(1, side === "actifs" ? t.actifs : t.dettes)) * 100;
          return (
            <section key={g.type} aria-labelledby={`group-${g.type}`}>
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CategoryIcon type={g.type} /></span>
                  <div><h2 id={`group-${g.type}`} className="text-sm font-semibold">{TYPE_LABELS[g.type]}</h2><p className="text-[11px] text-muted-foreground">{g.items.length} ligne{g.items.length > 1 ? "s" : ""} · {rawPct(share, 0)}</p></div>
                </div>
                <span className="num text-sm font-semibold">{eur(sub)}</span>
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((a) => (
                  <AssetRow
                    key={a.id}
                    asset={a}
                    share={Math.abs(assetValue(a)) / Math.max(1, side === "actifs" ? t.actifs : t.dettes) * 100}
                    onOpen={() => a.data["ticker"] ? setAnalyzing(a) : setEditing(a)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {!groups.length && (
          <div className="card-surface flex flex-col items-center gap-2 px-5 py-10 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Landmark className="size-5" /></span><p className="text-sm font-semibold">Aucune ligne pour l&apos;instant</p><p className="text-xs text-muted-foreground">Ajoutez un actif ou un passif pour commencer votre suivi.</p></div>
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
      {analyzing && (
        <AssetAnalysis
          asset={analyzing}
          risk={profile?.riskProfile ?? "equilibre"}
          onEdit={() => {
            setEditing(analyzing);
            setAnalyzing(null);
          }}
          onSell={() => {
            if (
              window.confirm(
                `Retirer « ${String(analyzing.data["name"] ?? "cette ligne")} » de votre patrimoine ? À utiliser après une vente.`,
              )
            ) {
              removeAsset(analyzing.id);
              setAnalyzing(null);
              toast.success("Ligne retirée");
            }
          }}
          onClose={() => setAnalyzing(null)}
        />
      )}
    </main>
  );
}

function CategoryIcon({ type }: { type: AssetType }) {
  const Icon = { pea: Landmark, av: ShieldCheck, livret: PiggyBank, immo: Home, crypto: Bitcoin, cash: Banknote, autre: Package, credit: CreditCard }[type];
  return <Icon aria-hidden="true" className="size-4" />;
}

function AssetRow({ asset, share, onOpen }: { asset: Asset; share: number; onOpen: () => void }) {
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
      className="tap card-surface flex w-full flex-col gap-3 p-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted-foreground"><CategoryIcon type={asset.type} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{String(d["name"] ?? d["type"] ?? d["ticker"] ?? "Ligne")}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{tags.join(" · ") || TYPE_LABELS[asset.type]}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`num text-sm font-semibold ${asset.type === "credit" ? "text-destructive" : ""}`}>{eur(Math.abs(value))}</div>
          <div className="num text-[11px] text-muted-foreground">{rawPct(share, 1)}</div>
          {gain !== 0 && <div className={`num text-[11px] ${gain >= 0 ? "text-primary" : "text-destructive"}`}>{signedEur(gain)}</div>}
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
