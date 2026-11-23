import { CheckCircle2, Layers, ShieldCheck } from "lucide-react";
import type { ImportAction } from "@/lib/import-positions";
import { parseFrenchNumber } from "@/lib/import-positions";
import type { FieldSource, LoanImport } from "@/lib/loan-import";
import { remainingCapital } from "@/lib/loans";
import type { Asset } from "@/lib/types";

export type LoanDraft = {
  id: string;
  pret: LoanImport;
  nom: string;
  capitalInitial: string;
  taux: string;
  dureeMois: string;
  dateDebut: string;
  mensualite: string;
  refCapital: string;
  refDate: string;
  action: ImportAction;
  assetId: string;
  bienId: string;
  appliquerPaliers: boolean;
};

export function loanDraftToImport(row: LoanDraft): LoanImport {
  return {
    ...row.pret,
    nom: row.nom.trim() || row.pret.nom,
    capitalInitial: parseFrenchNumber(row.capitalInitial),
    taux: parseFrenchNumber(row.taux),
    dureeMois: parseFrenchNumber(row.dureeMois),
    dateDebut: /^\d{4}-\d{2}$/.test(row.dateDebut) ? row.dateDebut : null,
    mensualite: parseFrenchNumber(row.mensualite),
    refCapital: parseFrenchNumber(row.refCapital),
    refDate: /^\d{4}-\d{2}$/.test(row.refDate) ? row.refDate : null,
  };
}

export function isLoanDraftValid(row: LoanDraft): boolean {
  if (row.action === "ignore") return true;
  if (row.action === "update" && !row.assetId) return false;
  const loan = loanDraftToImport(row);
  return row.nom.trim().length > 0 && (loan.capitalInitial !== null || loan.refCapital !== null);
}

export function ImportLoanReview({
  rows,
  assets,
  warnings,
  onChange,
}: {
  rows: LoanDraft[];
  assets: Asset[];
  warnings: string[];
  onChange: (id: string, patch: Partial<LoanDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs leading-relaxed text-amber" role="note">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {rows.map((row) => (
        <LoanCard key={row.id} row={row} assets={assets} onChange={(patch) => onChange(row.id, patch)} />
      ))}
    </div>
  );
}

function LoanCard({
  row,
  assets,
  onChange,
}: {
  row: LoanDraft;
  assets: Asset[];
  onChange: (patch: Partial<LoanDraft>) => void;
}) {
  const credits = assets.filter((asset) => asset.type === "credit");
  const biens = assets.filter((asset) => asset.type === "immo");
  const matched = credits.find((asset) => asset.id === row.assetId);
  const { pret } = row;
  const source = (key: keyof LoanImport["sources"]) => pret.sources[key];

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{pret.type}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[pret.preteur, pret.captures > 1 ? `${pret.captures} captures fusionnées` : "1 capture"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${pret.confiance < 0.7 ? "border-amber/40 bg-amber/10 text-amber" : "border-primary/30 bg-primary/10 text-primary"}`}
        >
          <ShieldCheck className="mr-1 inline size-3" aria-hidden="true" />
          Confiance {Math.round(pret.confiance * 100)} %
        </span>
      </div>

      <Field label="Nom" value={row.nom} onChange={(value) => onChange({ nom: value })} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Montant emprunté (€)" value={row.capitalInitial} inputMode="decimal" source={source("capitalInitial")} onChange={(value) => onChange({ capitalInitial: value })} />
        <Field label="Taux nominal (%)" value={row.taux} inputMode="decimal" source={source("taux")} onChange={(value) => onChange({ taux: value })} />
        <Field label="Durée (mois)" value={row.dureeMois} inputMode="numeric" source={source("dureeMois")} onChange={(value) => onChange({ dureeMois: value })} />
        <Field label="1re échéance" type="month" value={row.dateDebut} source={source("dateDebut")} onChange={(value) => onChange({ dateDebut: value })} />
        <Field label="Mensualité hors assurance (€)" value={row.mensualite} inputMode="decimal" source={source("mensualite")} onChange={(value) => onChange({ mensualite: value })} />
        <Field label="Capital restant dû (€)" value={row.refCapital} inputMode="decimal" source={source("refCapital")} onChange={(value) => onChange({ refCapital: value })} />
        <Field label="Restant dû après l'échéance de" type="month" value={row.refDate} source={source("refDate")} onChange={(value) => onChange({ refDate: value })} />
      </div>

      {pret.paliers && pret.paliers.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Layers className="size-3.5" aria-hidden="true" /> Paliers déduits
          </p>
          {pret.paliersExplication && <p className="text-xs leading-relaxed text-muted-foreground">{pret.paliersExplication}</p>}
          <ul className="flex flex-col gap-0.5 text-xs">
            {pret.paliers.map((tier) => (
              <li key={tier.debutMois} className="num">
                À partir du mois {tier.debutMois}
                {row.dateDebut ? ` (${monthName(row.dateDebut, tier.debutMois)})` : ""} : {formatEuros(tier.mensualite)}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={row.appliquerPaliers}
              onChange={(event) => onChange({ appliquerPaliers: event.target.checked })}
              className="size-4 accent-primary"
            />
            Appliquer ces paliers
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Action proposée</span>
          <select
            value={row.action}
            onChange={(event) => onChange({ action: event.target.value as ImportAction })}
            className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-sm outline-none focus:border-primary"
          >
            <option value="update" disabled={!row.assetId}>Mettre à jour</option>
            <option value="create">Créer</option>
            <option value="ignore">Ignorer</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Crédit correspondant</span>
          <select
            value={row.assetId}
            onChange={(event) => {
              const asset = credits.find((candidate) => candidate.id === event.target.value);
              onChange({
                assetId: event.target.value,
                action: event.target.value ? "update" : row.action === "update" ? "create" : row.action,
                bienId: asset ? String(asset.data["bienId"] ?? "") : row.bienId,
              });
            }}
            className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-xs outline-none focus:border-primary"
          >
            <option value="">Aucun — créer un crédit</option>
            {credits.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {String(asset.data["name"] ?? "Crédit sans nom")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {biens.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bien financé</span>
          <select
            value={row.bienId}
            onChange={(event) => onChange({ bienId: event.target.value })}
            className="h-10 w-full rounded-lg border border-border bg-elevated px-2 text-xs outline-none focus:border-primary"
          >
            <option value="">Aucun</option>
            {biens.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {String(asset.data["name"] ?? asset.data["type"] ?? "Bien")}
              </option>
            ))}
          </select>
        </label>
      )}
      {matched && row.action === "update" && (
        <p className="rounded-lg bg-elevated px-3 py-2 text-[11px] text-muted-foreground">
          Capital restant {formatEuros(remainingCapital(matched.data))} → {formatEuros(parseFrenchNumber(row.refCapital))}
        </p>
      )}

      {pret.verifications.length > 0 && (
        <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
          {pret.verifications.map((item) => (
            <li key={item} className="flex gap-1.5">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {pret.avertissements.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs leading-relaxed text-amber" role="note">
          {pret.avertissements.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
    </article>
  );
}

const SOURCE_LABEL: Record<FieldSource, string> = { lu: "lu", calculé: "calculé", déduit: "à vérifier" };

function Field({
  label,
  value,
  onChange,
  source,
  type = "text",
  inputMode = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  source?: FieldSource | undefined;
  type?: "text" | "month";
  inputMode?: "text" | "decimal" | "numeric";
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{label}</span>
        {source && (
          <span className={`shrink-0 normal-case tracking-normal ${source === "déduit" ? "text-amber" : "text-muted-foreground/70"}`}>
            {SOURCE_LABEL[source]}
          </span>
        )}
      </span>
      <input
        type={type}
        value={value}
        inputMode={type === "month" ? undefined : inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-elevated px-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function monthName(start: string, index: number): string {
  const [year, month] = start.split("-").map(Number);
  if (!year || !month) return "";
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1 + index - 1, 1)),
  );
}

function formatEuros(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
}
