import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Plus, RotateCcw } from "lucide-react";
import { useApp } from "@/lib/storage";
import {
  RISK_LABELS,
  TARGET_ALLOCATIONS,
  type Goal,
  type Profile,
  type RiskProfile,
} from "@/lib/types";
import { eur, rawPct } from "@/lib/format";
import { GOAL_KIND_LABELS, goalProgress, profileGoals } from "@/lib/goals";
import { GoalEditor } from "@/components/GoalEditor";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — Patrimoine" },
      {
        name: "description",
        content: "Vos informations, votre profil de risque et votre objectif d'investissement.",
      },
      { property: "og:title", content: "Profil — Patrimoine" },
      {
        property: "og:description",
        content: "Vos informations, votre profil de risque et votre objectif d'investissement.",
      },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const { profile, assets, saveProfile, reset } = useApp();
  const [form, setForm] = useState<Profile>(profile!);
  const [editing, setEditing] = useState<Goal | null | "new">(null);
  const goals = useMemo(() => profileGoals(form), [form]);

  const persistGoals = (next: Goal[]) => {
    update({
      goals: next,
      ...(next[0]
        ? { goal: { amount: next[0].amount, horizon: next[0].horizon, dca: next[0].dca } }
        : {}),
    });
  };

  const update = (patch: Partial<Profile>) => {
    const next = { ...form, ...patch };
    setForm(next);
    saveProfile(next);
  };

  return (
    <div className="fade-up px-4 pt-6">
      <h1 className="font-display text-2xl">Profil</h1>

      <section className="card-surface mt-5 space-y-3 p-5">
        <Row
          label="Prénom"
          value={form.name}
          onChange={(v) => update({ name: v })}
        />
        <Row
          label="Âge"
          value={String(form.age)}
          numeric
          onChange={(v) => update({ age: Number(v) || 0 })}
        />
        <Row
          label="Profession"
          value={form.profession}
          onChange={(v) => update({ profession: v })}
        />
        <Row
          label="Revenu net mensuel (€)"
          value={String(form.incomeMonthly)}
          numeric
          onChange={(v) => update({ incomeMonthly: Number(v) || 0 })}
        />
      </section>

      <section className="card-surface mt-4 p-5">
        <h2 className="text-sm font-semibold">Profil de risque</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(TARGET_ALLOCATIONS) as RiskProfile[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update({ riskProfile: r })}
              className={`tap rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                form.riskProfile === r
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {RISK_LABELS[r]}
            </button>
          ))}
        </div>
      </section>

      <section className="card-surface mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mes objectifs</h2>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
          >
            <Plus className="size-3" /> Ajouter
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {goals.map((g) => {
            const p = goalProgress(assets, g);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setEditing(g)}
                  className="tap w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-left"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{g.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {eur(g.amount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {GOAL_KIND_LABELS[g.kind]} · {g.horizon} ans · {eur(g.dca)}/mois
                    </span>
                    <span>{rawPct(p)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-card">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${p}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
          {!goals.length && (
            <p className="text-sm text-muted-foreground">
              Aucun objectif. Ajoute un objectif de patrimoine, d'enveloppe ou d'achat immobilier.
            </p>
          )}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => update({ hideAmounts: !form.hideAmounts })}
        className="tap mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2">
          {form.hideAmounts ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          Mode discret
        </span>
        <span className="text-xs text-muted-foreground">
          {form.hideAmounts ? "activé" : "désactivé"}
        </span>
      </button>

      {editing !== null && (
        <GoalEditor
          goal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            const exists = goals.some((x) => x.id === g.id);
            persistGoals(exists ? goals.map((x) => (x.id === g.id ? g : x)) : [...goals, g]);
            setEditing(null);
          }}
          {...(editing !== "new"
            ? {
                onDelete: (id: string) => {
                  persistGoals(goals.filter((x) => x.id !== id));
                  setEditing(null);
                },
              }
            : {})}
        />
      )}

      <button
        type="button"
        onClick={() => {
          if (window.confirm("Effacer toutes les données ?")) reset();
        }}
        className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm font-semibold text-destructive"
      >
        <RotateCcw className="size-4" /> Tout réinitialiser
      </button>
    </div>
  );
}

function Row({
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
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
