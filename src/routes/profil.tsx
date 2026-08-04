import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, Plus, RotateCcw, Upload } from "lucide-react";
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
import { daysSinceBackup, exportBackup, restoreBackup } from "@/lib/backup";
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
  const [editing, setEditing] = useState<Goal | null | "new">(null);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const goals = useMemo(() => profileGoals(profile), [profile]);

  // Profil absent (premier lancement ou après réinitialisation) :
  // la page d'accueil affiche l'onboarding, rien à montrer ici.
  if (!profile) return null;

  const update = (patch: Partial<Profile>) => saveProfile({ ...profile, ...patch });

  const persistGoals = (next: Goal[]) => {
    update({
      goals: next,
      ...(next.some((g) => g.id === profile.activeGoalId)
        ? {}
        : next[0]
          ? { activeGoalId: next[0].id }
          : {}),
      // Champ legacy maintenu en phase (zéros si plus aucun objectif).
      goal: next[0]
        ? { amount: next[0].amount, horizon: next[0].horizon, dca: next[0].dca }
        : { amount: 0, horizon: 10, dca: 0 },
    });
  };

  const onImport = async (file: File) => {
    try {
      const lines = JSON.parse(await file.text())?.assets?.length ?? 0;
      if (!window.confirm(`Remplacer les données actuelles par cette sauvegarde (${lines} ligne${lines > 1 ? "s" : ""}) ?`)) return;
      await restoreBackup(file);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Import impossible.");
    }
  };

  const backupAge = daysSinceBackup(profile);

  return (
    <div className="fade-up px-4 pt-6">
      <h1 className="font-display text-2xl">Profil</h1>

      <section className="card-surface mt-5 space-y-3 p-5">
        <Row label="Prénom" value={profile.name} onChange={(v) => update({ name: v })} />
        <Row
          label="Âge"
          value={String(profile.age || "")}
          numeric
          onChange={(v) => update({ age: Number(v) || 0 })}
        />
        <Row
          label="Profession"
          value={profile.profession}
          onChange={(v) => update({ profession: v })}
        />
        <Row
          label="Revenu net mensuel (€)"
          value={String(profile.incomeMonthly || "")}
          numeric
          onChange={(v) => update({ incomeMonthly: Number(v.replace(",", ".")) || 0 })}
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
                profile.riskProfile === r
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

      <section className="card-surface mt-4 p-5">
        <h2 className="text-sm font-semibold">Vos données</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Tout est stocké sur cet appareil.{" "}
          {backupAge === undefined
            ? "Aucune sauvegarde exportée pour l'instant."
            : `Dernier export il y a ${backupAge} jour${backupAge > 1 ? "s" : ""}.`}{" "}
          Exportez un fichier pour changer d'appareil ou vous prémunir d'une perte.
        </p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => exportBackup()}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold"
          >
            <Download className="size-4" /> Exporter une sauvegarde
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold"
          >
            <Upload className="size-4" /> Importer une sauvegarde
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          {importMsg && <p className="text-[11px] text-destructive">{importMsg}</p>}
        </div>
      </section>

      <button
        type="button"
        onClick={() => update({ hideAmounts: !profile.hideAmounts })}
        className="tap mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2">
          {profile.hideAmounts ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          Mode discret
        </span>
        <span className="text-xs text-muted-foreground">
          {profile.hideAmounts ? "activé" : "désactivé"}
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
          if (window.confirm("Effacer toutes les données de cet appareil ? Pensez à exporter une sauvegarde avant.")) reset();
        }}
        className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm font-semibold text-destructive"
      >
        <RotateCcw className="size-4" /> Tout réinitialiser
      </button>
    </div>
  );
}

/**
 * Champ d'édition. Les champs numériques gardent la saisie en local :
 * on peut vider le champ ou taper une virgule sans que "0" s'impose.
 */
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
  const [text, setText] = useState(value);
  // Pas de resynchronisation nécessaire : les changements externes
  // (import, réinitialisation) rechargent ou démontent la page.

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        value={text}
        inputMode={numeric ? "decimal" : "text"}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (!numeric || t === "" || Number.isFinite(Number(t.replace(",", ".")))) {
            if (!(numeric && t === "")) onChange(t);
          }
        }}
        onBlur={() => {
          if (numeric && text === "") {
            onChange("0");
            setText("");
          }
        }}
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
