import { useState } from "react";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { PlanLine, RiskProfile } from "@/lib/types";
import { RISK_LABELS, TARGET_ALLOCATIONS } from "@/lib/types";
import { uid } from "@/lib/storage";

/**
 * Éditeur de la répartition du versement mensuel.
 * - null enregistré = plan conseillé (dérivé du profil de risque)
 * - sinon, lignes libres avec un poids en % chacune
 */
export function PlanEditor({
  lines,
  risk,
  onClose,
  onSave,
}: {
  lines: PlanLine[] | undefined;
  risk: RiskProfile;
  onClose: () => void;
  onSave: (lines: PlanLine[] | undefined) => void;
}) {
  const [rows, setRows] = useState<PlanLine[]>(
    lines?.length ? lines.map((l) => ({ ...l })) : defaultLines(risk),
  );
  const total = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);

  const set = (id: string, patch: Partial<PlanLine>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const t = TARGET_ALLOCATIONS[risk];

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
        >
          <X className="size-4" />
        </button>
        <h2 className="font-display text-lg">Mon plan mensuel</h2>
        <div className="size-9" />
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-28">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Répartissez votre versement comme vous l'entendez : chaque ligne reçoit
          son poids en % du total. Le plan conseillé suit l'allocation cible de
          votre profil {RISK_LABELS[risk].toLowerCase()} ({t.actions} % actions ·{" "}
          {t.obligations} % fonds € · {t.immo} % immo · {t.cash} % cash).
        </p>

        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
            >
              <input
                value={r.label}
                onChange={(e) => set(r.id, { label: e.target.value })}
                placeholder="ETF Monde, PEA…"
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
              />
              <div className="flex items-center gap-1">
                <input
                  value={Number.isFinite(r.weight) ? String(r.weight) : ""}
                  inputMode="decimal"
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(",", "."));
                    set(r.id, { weight: Number.isFinite(v) ? v : 0 });
                  }}
                  className="h-10 w-14 rounded-lg border border-border bg-elevated px-2 text-right font-mono text-sm outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                aria-label="Supprimer la ligne"
                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                className="tap flex size-9 shrink-0 items-center justify-center rounded-full text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { id: uid(), label: "", weight: 10 }])}
          className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
        >
          <Plus className="size-4" /> Ajouter une ligne
        </button>

        <button
          type="button"
          onClick={() => setRows(defaultLines(risk))}
          className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
        >
          <RotateCcw className="size-4" /> Revenir au plan conseillé
        </button>

        <p
          className={`text-center font-mono text-xs ${
            Math.round(total) === 100 ? "text-muted-foreground" : "text-amber"
          }`}
        >
          Total : {Math.round(total)} %{" "}
          {Math.round(total) !== 100 && "— les montants seront proratisés"}
        </p>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(undefined)}
            className="tap flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground"
          >
            Plan conseillé
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(rows.filter((r) => r.label.trim() && r.weight > 0))
            }
            className="tap flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Enregistrer
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Plan conseillé : dérivé de l'allocation cible du profil de risque. */
export function defaultLines(risk: RiskProfile): PlanLine[] {
  const a = TARGET_ALLOCATIONS[risk] ?? TARGET_ALLOCATIONS.equilibre;
  return [
    { id: uid(), emoji: "🌍", label: "ETF Monde", weight: Math.round(a.actions * 0.6) },
    { id: uid(), emoji: "🇪🇺", label: "Stoxx Europe 600", weight: Math.round(a.actions * 0.25) },
    { id: uid(), emoji: "🐣", label: "Small caps", weight: Math.round(a.actions * 0.15) },
    { id: uid(), emoji: "🏦", label: "Fonds € (AV)", weight: a.obligations },
    { id: uid(), emoji: "🏠", label: "SCPI / immo papier", weight: a.immo },
    { id: uid(), emoji: "💧", label: "Livret (précaution)", weight: a.cash },
  ].filter((l) => l.weight > 0);
}
