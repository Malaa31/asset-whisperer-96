import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { useApp } from "@/lib/storage";
import { RISK_LABELS, TARGET_ALLOCATIONS, type Profile, type RiskProfile } from "@/lib/types";
import { eur } from "@/lib/format";

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
  const { profile, saveProfile, reset } = useApp();
  const [form, setForm] = useState<Profile>(profile!);

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

      <section className="card-surface mt-4 space-y-3 p-5">
        <h2 className="text-sm font-semibold">Objectif — {eur(form.goal.amount)}</h2>
        <Row
          label="Montant cible (€)"
          numeric
          value={String(form.goal.amount)}
          onChange={(v) => update({ goal: { ...form.goal, amount: Number(v) || 0 } })}
        />
        <Row
          label="Horizon (années)"
          numeric
          value={String(form.goal.horizon)}
          onChange={(v) => update({ goal: { ...form.goal, horizon: Number(v) || 1 } })}
        />
        <Row
          label="Versement mensuel (€)"
          numeric
          value={String(form.goal.dca)}
          onChange={(v) => update({ goal: { ...form.goal, dca: Number(v) || 0 } })}
        />
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
