import { LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { checkPosition, checkTotal } from "@/lib/ocr/checks";
import { resolveInstrument } from "@/lib/ocr/names";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  matchPosition,
  parseFrenchNumber,
  type Envelope,
  type ImportAction,
  type ImportControl,
  type ImportExtraction,
  type PositionLine,
  type SavingsLine,
} from "@/lib/import-positions";
import type { Asset } from "@/lib/types";

type SearchHit = { symbol: string; name: string; exchange?: string; type?: string };

export type PositionDraft = {
  id: string;
  nom: string;
  isin: string;
  ticker: string;
  quantite: string;
  pru: string;
  cours: string;
  valeur: number | null;
  devise: string;
  confiance: number;
  enveloppe: Envelope;
  action: ImportAction;
  assetId: string;
};

export type SavingsDraft = {
  etablissement: string;
  libelle: string;
  solde: string;
  date: string;
  confiance: number;
  action: ImportAction;
  assetId: string;
};

export function ImportCaptureReview({
  extraction,
  assets,
  absentAssets,
  positionRows,
  savingsRow,
  positionControls,
  savingsControls,
  searchingId,
  searchHits,
  onPositionChange,
  onSavingsChange,
  onSearch,
  onSelectHit,
  accountTotal = null,
}: {
  accountTotal?: number | null | undefined;
  extraction: ImportExtraction;
  assets: Asset[];
  absentAssets: Asset[];
  positionRows: PositionDraft[];
  savingsRow: SavingsDraft | null;
  positionControls: ImportControl[];
  savingsControls: ImportControl[];
  searchingId: string | null;
  searchHits: Record<string, SearchHit[]>;
  onPositionChange: (id: string, patch: Partial<PositionDraft>) => void;
  onSavingsChange: (patch: Partial<SavingsDraft>) => void;
  onSearch: (row: PositionDraft) => void;
  onSelectHit: (id: string, hit: SearchHit) => void;
}) {
  const sum = positionRows.filter((row) => row.action !== "ignore").reduce((acc, row) => acc + (row.valeur ?? 0), 0);
  const totalAlert = extraction.kind === "titres" ? checkTotal(accountTotal, positionRows.map((row) => row.valeur)) : null;
  return (
    <div className="flex flex-col gap-4">
      {extraction.kind === "titres" && accountTotal !== null && (
        <p className={`rounded-lg border px-3 py-2 text-xs ${totalAlert ? "border-orange/60 bg-orange/10 text-orange" : "border-border bg-elevated text-muted-foreground"}`} role="status">
          Total du compte lu : <b className="num">{formatEuro(accountTotal)}</b> · somme des lignes : <b className="num">{formatEuro(sum)}</b>
          {totalAlert ? ` — ${totalAlert}` : accountTotal - sum > 0.01 ? " (écart = espèces ou lignes hors capture)" : ""}
        </p>
      )}
      {extraction.avertissements.length > 0 && (
        <Alert className="border-amber/40 bg-amber/10 text-foreground">
          <AlertDescription className="text-xs leading-relaxed text-amber">
            {extraction.avertissements.join(" · ")}
          </AlertDescription>
        </Alert>
      )}
      {extraction.kind === "titres" ? (
        <div className="flex flex-col gap-3">
          {positionRows.map((row, index) => (
            <PositionReviewRow
              key={row.id}
              row={row}
              controlWarnings={positionControls[index]?.avertissements ?? []}
              assets={assets}
              busy={searchingId === row.id}
              searchHits={searchHits[row.id] ?? []}
              onChange={(patch) => onPositionChange(row.id, patch)}
              onSearch={() => onSearch(row)}
              onSelectHit={(hit) => onSelectHit(row.id, hit)}
            />
          ))}
          {!positionRows.length && (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Aucune ligne de titre détectée.
            </p>
          )}
          {absentAssets.length > 0 && (
            <section
              className="rounded-xl border border-border bg-card p-4"
              aria-labelledby="absent-captures-title"
            >
              <h3 id="absent-captures-title" className="text-sm font-semibold">
                Absentes de la capture
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Ces lignes restent dans ton patrimoine. Aucune suppression automatique.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {absentAssets.map((asset) => (
                  <li key={asset.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">
                      {String(asset.data["name"] ?? "Ligne sans nom")}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {String(asset.data["envelope"] ?? "PEA")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : savingsRow ? (
        <SavingsReviewRow
          row={savingsRow}
          warnings={savingsControls[0]?.avertissements ?? []}
          assets={assets}
          onChange={onSavingsChange}
        />
      ) : null}
    </div>
  );
}

function PositionReviewRow({
  row,
  controlWarnings,
  assets,
  busy,
  searchHits,
  onChange,
  onSearch,
  onSelectHit,
}: {
  row: PositionDraft;
  controlWarnings: string[];
  assets: Asset[];
  busy: boolean;
  searchHits: SearchHit[];
  onChange: (patch: Partial<PositionDraft>) => void;
  onSearch: () => void;
  onSelectHit: (hit: SearchHit) => void;
}) {
  const envelopeAssets = assets.filter(
    (asset) =>
      asset.type === "pea" &&
      String(asset.data["envelope"] ?? "PEA").toUpperCase() === row.enveloppe,
  );
  const matchedAsset = assets.find((asset) => asset.id === row.assetId && asset.type === "pea");
  // Contrôles de cohérence recalculés à chaque modification : champ douteux = surligné en orange.
  const flags = checkPosition({
    nom: row.nom,
    isin: row.isin.trim() || null,
    quantite: parseFrenchNumber(row.quantite),
    pru: row.pru.trim() ? parseFrenchNumber(row.pru) : null,
    cours: row.cours.trim() ? parseFrenchNumber(row.cours) : null,
    valeur: row.valeur,
    nomReconnu: Boolean(row.isin.trim() || row.assetId || resolveInstrument(row.nom)),
  });
  const setEnvelope = (enveloppe: Envelope) => {
    const match = matchPosition(
      { nom: row.nom, isin: row.isin, ticker: row.ticker },
      assets,
      enveloppe,
    );
    onChange({
      enveloppe,
      assetId: match?.id ?? "",
      action: match ? "update" : row.action === "update" ? "create" : row.action,
    });
  };
  return (
    <article data-position-card className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label
            className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            htmlFor={`${row.id}-name`}
          >
            Nom
          </label>
          <input
            id={`${row.id}-name`}
            value={row.nom}
            onChange={(event) => onChange({ nom: event.target.value })}
            aria-invalid={Boolean(flags.nom)}
            data-alert={flags.nom ? "true" : undefined}
            className={`mt-1 h-10 w-full rounded-lg border px-2.5 text-sm outline-none focus:border-primary ${flags.nom ? "border-orange bg-orange/10" : "border-border bg-elevated"}`}
          />
          {flags.nom && <span className="mt-1 block text-[11px] leading-snug text-orange">{flags.nom}</span>}
        </div>
        <ConfidenceBadge value={row.confiance} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField label="ISIN" value={row.isin} alert={flags.isin} onChange={(value) => onChange({ isin: value })} />
        <TextField
          label="Ticker"
          value={row.ticker}
          onChange={(value) => onChange({ ticker: value })}
        />
        <TextField
          label="Quantité"
          value={row.quantite}
          inputMode="decimal"
          alert={flags.quantite}
          onChange={(value) => onChange({ quantite: value })}
        />
        <TextField
          label="PRU (€)"
          value={row.pru}
          inputMode="decimal"
          alert={flags.pru}
          onChange={(value) => onChange({ pru: value })}
        />
        <TextField
          label="Cours (€)"
          value={row.cours}
          inputMode="decimal"
          alert={flags.cours}
          onChange={(value) => onChange({ cours: value })}
        />
        <div className="min-w-0">
          <span className="mb-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valorisation lue</span>
          <div data-alert={flags.valeur ? "true" : undefined} className={`flex h-10 items-center rounded-lg border px-2.5 text-sm num ${flags.valeur ? "border-orange bg-orange/10" : "border-border bg-elevated"}`}>
            {row.valeur === null ? "—" : formatEuro(row.valeur)}
          </div>
          {flags.valeur && <span className="mt-1 block text-[11px] leading-snug text-orange">{flags.valeur}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Enveloppe
          </span>
          <select
            value={row.enveloppe}
            onChange={(event) => setEnvelope(event.target.value as Envelope)}
            className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-sm outline-none focus:border-primary"
          >
            <option value="PEA">PEA</option>
            <option value="CTO">CTO</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Action proposée
          </span>
          <select
            value={row.action}
            onChange={(event) => onChange({ action: event.target.value as ImportAction })}
            className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-sm outline-none focus:border-primary"
          >
            <option value="update" disabled={!row.assetId}>
              Mettre à jour
            </option>
            <option value="create">Créer</option>
            <option value="ignore">Ignorer</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ligne existante correspondante
        </span>
        <select
          value={row.assetId}
          onChange={(event) =>
            onChange({
              assetId: event.target.value,
              action: event.target.value
                ? "update"
                : row.action === "update"
                  ? "create"
                  : row.action,
            })
          }
          className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-xs outline-none focus:border-primary"
        >
          <option value="">Aucune — créer une nouvelle ligne</option>
          {envelopeAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {String(asset.data["name"] ?? "Ligne sans nom")} ·{" "}
              {String(asset.data["ticker"] ?? asset.data["isin"] ?? "sans code")}
            </option>
          ))}
        </select>
      </label>
      {matchedAsset && row.action === "update" && (
        <p className="rounded-lg bg-elevated px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Quantité {formatNumber(matchedAsset.data["quantity"])} → {formatNumber(row.quantite)} ·
          PRU {formatNumber(matchedAsset.data["pru"])} € → {formatNumber(row.pru)} €
        </p>
      )}
      {!row.ticker && row.action !== "ignore" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSearch}
            disabled={busy}
            className="tap flex items-center justify-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}{" "}
            Chercher une référence par ISIN puis par nom
          </button>
          {searchHits.length > 0 && (
            <ul
              className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-2"
              aria-label="Références trouvées"
            >
              {searchHits.map((hit) => (
                <li key={hit.symbol}>
                  <button
                    type="button"
                    onClick={() => onSelectHit(hit)}
                    className="tap w-full rounded-md px-2 py-2 text-left text-xs hover:bg-card"
                  >
                    <span className="font-semibold">{hit.name}</span>
                    <span className="ml-2 text-muted-foreground">{hit.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {controlWarnings.length > 0 && (
        <div
          className="flex flex-col gap-1 rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs leading-relaxed text-amber"
          role="note"
        >
          {controlWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
    </article>
  );
}

function SavingsReviewRow({
  row,
  warnings,
  assets,
  onChange,
}: {
  row: SavingsDraft;
  warnings: string[];
  assets: Asset[];
  onChange: (patch: Partial<SavingsDraft>) => void;
}) {
  const livretAssets = assets.filter((asset) => asset.type === "livret");
  const matchedAsset = assets.find((asset) => asset.id === row.assetId && asset.type === "livret");
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Solde détecté</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.etablissement || "Établissement non identifié"}
          </p>
        </div>
        <ConfidenceBadge value={row.confiance} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Établissement"
          value={row.etablissement}
          onChange={(value) => onChange({ etablissement: value })}
        />
        <TextField
          label="Libellé"
          value={row.libelle}
          onChange={(value) => onChange({ libelle: value })}
        />
      </div>
      <TextField
        label="Montant (€)"
        value={row.solde}
        inputMode="decimal"
        onChange={(value) => onChange({ solde: value })}
      />
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Action proposée
        </span>
        <select
          value={row.action}
          onChange={(event) => onChange({ action: event.target.value as ImportAction })}
          className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-sm outline-none focus:border-primary"
        >
          <option value="update" disabled={!row.assetId}>
            Mettre à jour
          </option>
          <option value="create">Créer</option>
          <option value="ignore">Ignorer</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Livret correspondant
        </span>
        <select
          value={row.assetId}
          onChange={(event) =>
            onChange({
              assetId: event.target.value,
              action: event.target.value
                ? "update"
                : row.action === "update"
                  ? "create"
                  : row.action,
            })
          }
          className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-xs outline-none focus:border-primary"
        >
          <option value="">Aucun — créer un livret</option>
          {livretAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {String(asset.data["name"] ?? "Livret sans nom")}
            </option>
          ))}
        </select>
      </label>
      {matchedAsset && row.action === "update" && (
        <p className="rounded-lg bg-elevated px-3 py-2 text-[11px] text-muted-foreground">
          Solde {formatNumber(matchedAsset.data["amount"])} € → {formatNumber(row.solde)} €
        </p>
      )}
      {warnings.length > 0 && (
        <div
          className="flex flex-col gap-1 rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs leading-relaxed text-amber"
          role="note"
        >
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
    </article>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode = "text",
  alert,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "text" | "decimal";
  /** Motif du contrôle de cohérence en échec : champ surligné en orange. */
  alert?: string | undefined;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        aria-invalid={Boolean(alert)}
        data-alert={alert ? "true" : undefined}
        title={alert}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full rounded-lg border px-2.5 text-sm outline-none focus:border-primary ${alert ? "border-orange bg-orange/10" : "border-border bg-elevated"}`}
      />
      {alert && <span className="mt-1 block text-[11px] leading-snug text-orange">{alert}</span>}
    </label>
  );
}

function formatEuro(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
}

function formatNumber(value: unknown): string {
  const parsed = parseFrenchNumber(
    typeof value === "string" || typeof value === "number" ? value : null,
  );
  return parsed === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(parsed);
}

function ConfidenceBadge({ value }: { value: number }) {
  const low = value < 0.7;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${low ? "border-amber/40 bg-amber/10 text-amber" : "border-primary/30 bg-primary/10 text-primary"}`}
    >
      <ShieldCheck className="mr-1 inline size-3" aria-hidden="true" />
      Confiance {Math.round(value * 100)} %
    </span>
  );
}
