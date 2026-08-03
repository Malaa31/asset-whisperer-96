import { useState } from "react";
import { X, Trash2, RefreshCw, ArrowLeft } from "lucide-react";
import {
  Landmark,
  ShieldCheck,
  PiggyBank,
  Home,
  Bitcoin,
  Banknote,
  Package,
  CreditCard,
} from "lucide-react";
import type { Asset, AssetType } from "@/lib/types";
import { TYPE_LABELS } from "@/lib/types";
import { uid } from "@/lib/storage";
import { SymbolSearch, type SelectedSymbol } from "./SymbolSearch";
import { fetchQuote } from "@/lib/market";

type Field = {
  key: string;
  label: string;
  type?: "text" | "number";
  placeholder?: string;
};

const FIELDS: Record<AssetType, Field[]> = {
  pea: [
    { key: "envelope", label: "Enveloppe", placeholder: "PEA / CTO / PEE / PER" },
    { key: "name", label: "Nom" },
    { key: "ticker", label: "Ticker" },
    { key: "isin", label: "ISIN" },
    { key: "quantity", label: "Quantité", type: "number" },
    { key: "pru", label: "PRU (prix moyen d'achat)", type: "number" },
    { key: "currentPrice", label: "Prix actuel", type: "number" },
    { key: "sector", label: "Secteur" },
    { key: "region", label: "Région", placeholder: "Monde / États-Unis / Europe / Émergents" },
    { key: "ter", label: "TER (%)", type: "number" },
    { key: "currency", label: "Devise" },
  ],
  av: [
    { key: "name", label: "Nom du contrat" },
    { key: "assureur", label: "Assureur" },
    { key: "dateOuverture", label: "Date d'ouverture", placeholder: "2019-04" },
    { key: "fondsEurosAmount", label: "Montant fonds €", type: "number" },
    { key: "fondsEurosRendement", label: "Rendement fonds € (%)", type: "number" },
    { key: "ucAmount", label: "Montant UC", type: "number" },
    { key: "ucDescription", label: "Support UC" },
  ],
  livret: [
    { key: "type", label: "Type", placeholder: "Livret A, LDDS, LEP, PEL…" },
    { key: "amount", label: "Montant", type: "number" },
    { key: "taux", label: "Taux (%)", type: "number" },
  ],
  immo: [
    { key: "type", label: "Type", placeholder: "Résidence principale, Locatif, SCPI…" },
    { key: "name", label: "Nom" },
    { key: "adresse", label: "Adresse" },
    { key: "surface", label: "Surface (m²)", type: "number" },
    { key: "dpe", label: "DPE" },
    { key: "annee", label: "Année", type: "number" },
    { key: "valeurEstimee", label: "Valeur estimée", type: "number" },
    { key: "loyer", label: "Loyer mensuel", type: "number" },
  ],
  crypto: [
    { key: "ticker", label: "Ticker" },
    { key: "quantity", label: "Quantité", type: "number" },
    { key: "prixUnitaire", label: "Prix unitaire", type: "number" },
  ],
  cash: [
    { key: "name", label: "Nom du compte" },
    { key: "amount", label: "Montant", type: "number" },
  ],
  autre: [
    { key: "name", label: "Nom" },
    { key: "amount", label: "Valeur", type: "number" },
    { key: "description", label: "Description" },
  ],
  credit: [
    { key: "type", label: "Type", placeholder: "Prêt immobilier, conso, auto…" },
    { key: "name", label: "Nom" },
    { key: "preteur", label: "Prêteur" },
    { key: "capitalInitial", label: "Capital initial", type: "number" },
    { key: "capitalRestant", label: "Capital restant", type: "number" },
    { key: "taux", label: "Taux (%)", type: "number" },
    { key: "mensualite", label: "Mensualité", type: "number" },
    { key: "dureeRestante", label: "Durée restante (mois)", type: "number" },
    { key: "dateFin", label: "Date de fin" },
  ],
};

const TYPE_CARDS: Array<{ type: AssetType; Icon: typeof Home; color: string }> = [
  { type: "pea", Icon: Landmark, color: "text-primary" },
  { type: "av", Icon: ShieldCheck, color: "text-info" },
  { type: "livret", Icon: PiggyBank, color: "text-amber" },
  { type: "immo", Icon: Home, color: "text-orange" },
  { type: "crypto", Icon: Bitcoin, color: "text-violet" },
  { type: "cash", Icon: Banknote, color: "text-primary" },
  { type: "autre", Icon: Package, color: "text-muted-foreground" },
  { type: "credit", Icon: CreditCard, color: "text-destructive" },
];

export function AssetModal({
  asset,
  onClose,
  onSave,
  onDelete,
}: {
  asset: Asset | null;
  onClose: () => void;
  onSave: (a: Asset) => void;
  onDelete?: (id: string) => void;
}) {
  const [type, setType] = useState<AssetType | null>(asset?.type ?? null);
  const [mode, setMode] = useState<"search" | "manual">(asset ? "manual" : "search");
  const [data, setData] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (asset) for (const [k, v] of Object.entries(asset.data)) init[k] = String(v ?? "");
    return init;
  });
  const [fetching, setFetching] = useState(false);

  const searchable = type === "pea" || type === "crypto";

  const applySymbol = (s: SelectedSymbol) => {
    if (type === "crypto") {
      setData((d) => ({
        ...d,
        ticker: s.ticker,
        name: s.name,
        prixUnitaire: s.price ? String(s.price) : (d["prixUnitaire"] ?? ""),
      }));
    } else {
      setData((d) => ({
        ...d,
        envelope: d["envelope"] || (s.pea ? "PEA" : "CTO"),
        name: s.name,
        ticker: s.ticker,
        isin: s.isin ?? "",
        sector: s.sector,
        region: s.region,
        currency: s.currency,
        ter: s.ter ? String(s.ter) : "",
        currentPrice: s.price ? String(s.price) : (d["currentPrice"] ?? ""),
      }));
    }
    setMode("manual");
  };

  const refreshPrice = async () => {
    const ticker = data["ticker"];
    if (!ticker) return;
    setFetching(true);
    const q = await fetchQuote([ticker]);
    const price = q[ticker]?.price;
    if (price !== undefined) {
      setData((d) => ({
        ...d,
        [type === "crypto" ? "prixUnitaire" : "currentPrice"]: String(price),
        lastPriceUpdate: new Date().toISOString(),
      }));
    }
    setFetching(false);
  };

  const save = () => {
    if (!type) return;
    const clean: Record<string, string | number> = {};
    for (const f of FIELDS[type]) {
      const v = data[f.key];
      if (v === undefined || v === "") continue;
      clean[f.key] = f.type === "number" ? Number(v.replace(",", ".")) : v;
    }
    if (data["lastPriceUpdate"]) clean["lastPriceUpdate"] = data["lastPriceUpdate"];
    onSave({
      id: asset?.id ?? uid(),
      type,
      data: clean,
      createdAt: asset?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => (type && !asset ? setType(null) : onClose())}
          className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
          aria-label="Retour"
        >
          {type && !asset ? <ArrowLeft className="size-4" /> : <X className="size-4" />}
        </button>
        <h2 className="font-display text-lg">
          {asset ? "Modifier" : type ? TYPE_LABELS[type] : "Ajouter un actif"}
        </h2>
        <div className="size-9" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        {!type && (
          <div className="grid grid-cols-2 gap-3">
            {TYPE_CARDS.map(({ type: t, Icon, color }) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setMode(t === "pea" || t === "crypto" ? "search" : "manual");
                }}
                className="tap card-surface flex flex-col items-start gap-3 p-4 text-left"
              >
                <Icon className={`size-5 ${color}`} />
                <span className="text-sm font-semibold">{TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        )}

        {type && searchable && (
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1">
            {(["search", "manual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "search" ? "Recherche" : "Manuel"}
              </button>
            ))}
          </div>
        )}

        {type && searchable && mode === "search" && (
          <SymbolSearch
            kind={type === "crypto" ? "crypto" : "titre"}
            onSelect={applySymbol}
            onManual={() => setMode("manual")}
          />
        )}

        {type && (mode === "manual" || !searchable) && (
          <div className="space-y-3">
            {FIELDS[type].map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs text-muted-foreground">{f.label}</span>
                <input
                  inputMode={f.type === "number" ? "decimal" : "text"}
                  value={data[f.key] ?? ""}
                  placeholder={f.placeholder ?? ""}
                  onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
                />
              </label>
            ))}

            {searchable && (
              <button
                type="button"
                onClick={() => void refreshPrice()}
                disabled={!data["ticker"] || fetching}
                className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-sm font-semibold text-primary disabled:opacity-40"
              >
                <RefreshCw className={`size-4 ${fetching ? "animate-spin" : ""}`} />
                Récupérer le prix
              </button>
            )}

            {asset && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(asset.id)}
                className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive"
              >
                <Trash2 className="size-4" />
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>

      {type && (mode === "manual" || !searchable) && (
        <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <button
            type="button"
            onClick={save}
            className="tap w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}
