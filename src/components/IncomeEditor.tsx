import { useState } from "react";
import { useLockScroll } from "@/lib/useLockScroll";
import { useModalBack } from "@/hooks/useModalBack";
import { Plus, Trash2, X } from "lucide-react";
import {
  INCOME_KIND_EMOJI,
  INCOME_KIND_LABELS,
  type Income,
  type IncomeKind,
} from "@/lib/types";
import { eur } from "@/lib/format";
import { uid } from "@/lib/storage";
import { rentAfterVacancy } from "@/lib/rental";
import { n } from "@/lib/calc";
import type { Asset } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const KINDS: IncomeKind[] = ["salaire", "locatif", "dividendes", "autre"];

/** Somme des revenus mensuels — source de vérité pour `incomeMonthly`. */
export function totalIncome(incomes: Income[] | undefined): number {
  return (incomes ?? []).reduce((s, i) => s + (Number.isFinite(i.amountMonthly) ? i.amountMonthly : 0), 0);
}

/**
 * Éditeur des revenus récurrents. Plusieurs lignes possibles :
 * salaire, loyers perçus, dividendes… Le total alimente la capacité
 * d'épargne et les simulateurs.
 */
export function IncomeEditor({
  incomes,
  legacyIncomeMonthly,
  assets,
  onClose,
  onSave,
}: {
  incomes: Income[] | undefined;
  legacyIncomeMonthly: number;
  assets: Asset[];
  onClose: () => void;
  onSave: (next: Income[]) => void;
}) {
  useLockScroll(true);
  useModalBack(onClose);
  const [rows, setRows] = useState<Income[]>(() => {
    if (incomes?.length) return incomes.map((income) => ({ ...income }));
    if (legacyIncomeMonthly > 0) {
      return [{ id: uid(), kind: "autre", label: "Revenu mensuel enregistré", amountMonthly: legacyIncomeMonthly }];
    }
    return [];
  });
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((income) => [income.id, income.amountMonthly ? String(income.amountMonthly) : ""])),
  );

  const total = rows.reduce((s, r) => {
    const v = Number((drafts[r.id] ?? "").replace(",", "."));
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  const propertyRents = assets
    .filter((asset) => asset.type === "immo" && n(asset.data["loyer"]) > 0)
    .map((property) => ({
      id: property.id,
      name: String(property.data["name"] ?? property.data["type"] ?? "Bien immobilier"),
      amount: rentAfterVacancy(property),
    }));
  const totalWithRents = total + propertyRents.reduce((sum, rent) => sum + rent.amount, 0);
  const hasManualRentalIncome = rows.some((row) => row.kind === "locatif" && Number((drafts[row.id] ?? "0").replace(",", ".")) > 0);

  const add = (kind: IncomeKind) => {
    const row: Income = {
      id: uid(),
      kind,
      label: INCOME_KIND_LABELS[kind],
      amountMonthly: 0,
    };
    setRows((rs) => [...rs, row]);
    setDrafts((d) => ({ ...d, [row.id]: "" }));
  };

  const save = () =>
    onSave(
      rows
        .map((r) => {
          const v = Number((drafts[r.id] ?? "").replace(",", "."));
          return { ...r, amountMonthly: Number.isFinite(v) ? v : 0 };
        })
        .filter((r) => r.label.trim() && r.amountMonthly > 0),
    );

  return (
    <div className="mobile-sheet fixed inset-0 z-50 mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
        >
          <X className="size-4" />
        </button>
        <h2 className="font-display text-lg">Mes revenus</h2>
        <div className="size-9" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 pb-28">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Tes revenus nets mensuels. Ajoute autant de lignes que nécessaire —
          salaire, loyers perçus, dividendes. Le total sert à calculer ta
          capacité d'épargne.
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{INCOME_KIND_EMOJI[r.kind]}</span>
                <input
                  value={r.label}
                  onChange={(e) =>
                    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))
                  }
                  placeholder="Intitulé"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1">
                  <input
                    value={drafts[r.id] ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    className="h-10 w-24 rounded-lg border border-border bg-elevated px-2 text-right num text-sm outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">€</span>
                </div>
                <button
                  type="button"
                  aria-label="Supprimer"
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  className="tap flex size-9 shrink-0 items-center justify-center rounded-full text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {!rows.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun revenu enregistré.
            </p>
          )}
        </ul>

        {propertyRents.length > 0 && (
          <section className="mt-5" aria-label="Loyers des biens">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Loyers immobiliers comptabilisés</h3>
            <ul className="flex flex-col gap-2">
              {propertyRents.map((rent) => (
                <li key={rent.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 px-3 py-2.5 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">Loyer · {rent.name}</span>
                  <span className="shrink-0 num font-semibold">{eur(rent.amount)} / mois</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasManualRentalIncome && propertyRents.length > 0 && (
          <Alert className="mt-4 border-primary/20 bg-primary/5">
            <AlertTitle>Vérifiez les revenus locatifs</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
              Un revenu « Locatif » manuel et un loyer immobilier sont tous deux comptabilisés. Supprimez la ligne manuelle si elle correspond à l&apos;un de ces biens ; elle ne sera jamais supprimée automatiquement.
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Ajouter
          </p>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => add(k)}
                className="tap flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold"
              >
                <span>{INCOME_KIND_EMOJI[k]}</span>
                {INCOME_KIND_LABELS[k]}
                <Plus className="ml-auto size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-sm">
          Total pris en compte :{" "}
          <span className="font-display text-lg">{eur(totalWithRents)}</span>
          <span className="text-muted-foreground"> / mois</span>
        </p>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-card px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          type="button"
          onClick={save}
          className="tap h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground"
        >
          Enregistrer
        </button>
      </footer>
    </div>
  );
}
