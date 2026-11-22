import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { LoanDetails } from "@/components/LoanDetails";
import { eur } from "@/lib/format";
import { isAutomaticLoan, remainingCapital } from "@/lib/loans";
import type { Asset } from "@/lib/types";

type TierDraft = { debutMois: string; mensualite: string };

function readTiers(raw: string | undefined): TierDraft[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      debutMois: item?.debutMois === undefined ? "" : String(item.debutMois),
      mensualite: item?.mensualite === undefined ? "" : String(item.mensualite),
    }));
  } catch {
    return [];
  }
}

export function CreditAmortizationSection({
  data,
  setData,
  properties,
}: {
  data: Record<string, string>;
  setData: Dispatch<SetStateAction<Record<string, string>>>;
  properties: Asset[];
}) {
  const [tiers, setTiers] = useState(() => readTiers(data["paliers"]));
  const [recalibrating, setRecalibrating] = useState(Boolean(data["refDate"] || data["refCapital"]));
  const automatic = isAutomaticLoan(data);

  const update = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }));
  const updateTiers = (next: TierDraft[]) => {
    setTiers(next);
    setData((current) => {
      const updated = { ...current };
      if (!next.length) delete updated["paliers"];
      else {
        updated["paliers"] = JSON.stringify(
          next.map((tier) => ({
            debutMois: Number(tier.debutMois.replace(",", ".")) || 0,
            mensualite: Number(tier.mensualite.replace(",", ".")) || 0,
          })),
        );
      }
      return updated;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Bien financé</span>
        <select
          value={data["bienId"] ?? ""}
          onChange={(event) => update("bienId", event.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">Aucun bien associé</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {String(property.data["name"] ?? property.data["type"] ?? "Bien immobilier")}
            </option>
          ))}
        </select>
      </label>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Amortissement automatique</h3>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${automatic ? "bg-success/10 text-success" : "bg-elevated text-muted-foreground"}`}>
            {automatic ? "Actif" : "À compléter"}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Renseignez le mois de début, le capital initial et la durée pour calculer le capital restant automatiquement.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Date de début</span>
            <input
              type="month"
              value={data["dateDebut"] ?? ""}
              onChange={(event) => update("dateDebut", event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <NumberField label="Durée (mois)" value={data["dureeMois"]} onChange={(value) => update("dureeMois", value)} />
          <NumberField label="Capital initial (€)" value={data["capitalInitial"]} onChange={(value) => update("capitalInitial", value)} />
          <NumberField label="Taux annuel (%)" value={data["taux"]} onChange={(value) => update("taux", value)} />
          <div className="col-span-2">
            <NumberField
              label="Mensualité (€) · laisser vide pour une annuité standard"
              value={data["mensualite"]}
              onChange={(value) => update("mensualite", value)}
            />
          </div>
        </div>

        {automatic ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-elevated px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Capital restant calculé</span>
            <span className="num text-sm font-semibold text-primary">{eur(remainingCapital(data))}</span>
          </div>
        ) : (
          <div className="mt-3">
            <NumberField
              label="Capital restant manuel (€)"
              value={data["capitalRestant"]}
              onChange={(value) => update("capitalRestant", value)}
            />
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold">Paliers de mensualité</h4>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Chaque palier s&apos;applique jusqu&apos;au suivant.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextMonth = Math.max(0, ...tiers.map((tier) => Number(tier.debutMois) || 0)) + 1;
                updateTiers([...tiers, { debutMois: String(nextMonth), mensualite: "0" }]);
              }}
              className="tap flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-2 text-[11px] font-semibold text-primary"
            >
              <Plus className="size-3.5" /> Ajouter un palier
            </button>
          </div>
          {tiers.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <NumberField
                    label="Début du mois"
                    value={tier.debutMois}
                    onChange={(value) => updateTiers(tiers.map((item, i) => i === index ? { ...item, debutMois: value } : item))}
                  />
                  <NumberField
                    label="Mensualité (€)"
                    value={tier.mensualite}
                    onChange={(value) => updateTiers(tiers.map((item, i) => i === index ? { ...item, mensualite: value } : item))}
                  />
                  <button
                    type="button"
                    aria-label={`Supprimer le palier ${index + 1}`}
                    onClick={() => updateTiers(tiers.filter((_, i) => i !== index))}
                    className="tap mb-1 flex size-9 items-center justify-center rounded-lg text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            aria-expanded={recalibrating}
            onClick={() => {
              const next = !recalibrating;
              setRecalibrating(next);
              if (!next) setData((current) => {
                const updated = { ...current };
                delete updated["refDate"];
                delete updated["refCapital"];
                return updated;
              });
            }}
            className="tap text-xs font-semibold text-primary"
          >
            {recalibrating ? "Recalage sur un relevé activé" : "Recaler sur un relevé"}
          </button>
          {recalibrating && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Date du relevé</span>
                <input
                  type="month"
                  value={data["refDate"] ?? ""}
                  onChange={(event) => update("refDate", event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <NumberField label="Capital du relevé (€)" value={data["refCapital"]} onChange={(value) => update("refCapital", value)} />
            </div>
          )}
        </div>

        {automatic && <div className="mt-4"><LoanDetails credit={data} /></div>}
      </section>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string | undefined; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs leading-snug text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 num text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
