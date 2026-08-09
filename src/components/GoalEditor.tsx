import { useState } from "react";
import { Sheet } from "./Sheet";
import { useSheet } from "@/lib/useSheet";
import { useLockScroll } from "@/lib/useLockScroll";
import { useModalBack } from "@/hooks/useModalBack";
import { X, Trash2 } from "lucide-react";
import type { Goal, GoalKind, AssetType } from "@/lib/types";
import { GOAL_KIND_LABELS, GOAL_KIND_HINTS, ENVELOPE_OPTIONS, newGoal } from "@/lib/goals";

const KINDS: GoalKind[] = ["patrimoine", "enveloppe", "immo", "libre"];

export function GoalEditor({
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (g: Goal) => void;
  onDelete?: (id: string) => void;
}) {
  useSheet();
  useLockScroll(true);
  useModalBack(onClose);
  const [form, setForm] = useState<Goal>(goal ?? newGoal("patrimoine"));
  const set = (patch: Partial<Goal>) => setForm((f) => ({ ...f, ...patch }));

  const pickKind = (k: GoalKind) => {
    // Conserve la saisie en cours ; seul le libellé est remplacé,
    // et uniquement s'il correspondait encore à un preset.
    setForm((f) => {
      const isPresetLabel = KINDS.some((kk) => newGoal(kk).label === f.label);
      const preset = newGoal(k);
      const { scope: _drop, ...rest } = f;
      return {
        ...rest,
        kind: k,
        label: isPresetLabel ? preset.label : f.label,
        ...(k === "enveloppe" ? { scope: f.scope ?? ("pea" as const) } : {}),
      };
    });
  };

  return (
    <Sheet onClose={onClose}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
        >
          <X className="size-4" />
        </button>
        <h2 className="font-display text-lg">{goal ? "Modifier l'objectif" : "Nouvel objectif"}</h2>
        <div className="size-9" />
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-28">
        <div>
          <span className="mb-2 block text-xs text-muted-foreground">Type d'objectif</span>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickKind(k)}
                className={`tap rounded-xl border p-3 text-left ${
                  form.kind === k ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span className="block text-xs font-semibold">{GOAL_KIND_LABELS[k]}</span>
                <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                  {GOAL_KIND_HINTS[k]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Nom de l'objectif" value={form.label} onChange={(v) => set({ label: v })} />

        {form.kind === "enveloppe" && (
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Enveloppe suivie</span>
            <select
              value={form.scope ?? "pea"}
              onChange={(e) => set({ scope: e.target.value as AssetType })}
              className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
            >
              {ENVELOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <Field
          label="Montant cible (€)"
          numeric
          value={String(form.amount)}
          onChange={(v) => set({ amount: Number(v.replace(",", ".")) || 0 })}
        />
        <Field
          label="Horizon (années)"
          numeric
          value={String(form.horizon)}
          onChange={(v) => set({ horizon: Math.max(1, Number(v) || 1) })}
        />
        <Field
          label="Versement mensuel (€)"
          numeric
          value={String(form.dca)}
          onChange={(v) => set({ dca: Number(v.replace(",", ".")) || 0 })}
        />
        <Field
          label="Rendement annuel attendu (%)"
          numeric
          value={String(form.rate ?? 7.5)}
          onChange={(v) => set({ rate: Number(v.replace(",", ".")) || 0 })}
        />

        {goal && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(goal.id)}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive"
          >
            <Trash2 className="size-4" /> Supprimer l'objectif
          </button>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          type="button"
          onClick={() => onSave(form)}
          className="tap w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode={numeric ? "decimal" : "text"}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 num text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
