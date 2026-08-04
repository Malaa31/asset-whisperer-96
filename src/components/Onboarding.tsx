import { useMemo, useRef, useState } from "react";
import { ArrowRight, Plus, Upload } from "lucide-react";
import {
  RISK_LABELS,
  TARGET_ALLOCATIONS,
  type Goal,
  type Profile,
  type RiskProfile,
} from "@/lib/types";
import { eur } from "@/lib/format";
import { project } from "@/lib/calc";
import { restoreBackup } from "@/lib/backup";
import { uid } from "@/lib/storage";

/**
 * Trois écrans, une question par écran.
 * L'accroche n'est pas une liste de fonctionnalités mais une projection
 * chiffrée : l'utilisateur voit ce que l'app calcule avant de saisir
 * la moindre ligne.
 */

const REACTIONS: Array<{ risk: RiskProfile; label: string; detail: string; rate: number }> = [
  { risk: "prudent", label: "Je vends pour limiter la casse", detail: "La sécurité d'abord", rate: 3.5 },
  { risk: "equilibre", label: "Je réduis un peu, ça m'inquiète", detail: "Croissance sans stress", rate: 5.5 },
  { risk: "dynamique", label: "J'attends, ça finira par remonter", detail: "Le temps est mon allié", rate: 7.5 },
  { risk: "offensif", label: "J'en profite pour renforcer", detail: "Les baisses sont des soldes", rate: 8.5 },
];

const DCA_CHOICES = [100, 250, 500, 1000];
const HORIZON = 15;

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [risk, setRisk] = useState<RiskProfile | null>(null);
  const [dca, setDca] = useState(250);
  const [restoreError, setRestoreError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reaction = REACTIONS.find((r) => r.risk === risk) ?? REACTIONS[1]!;
  const target = TARGET_ALLOCATIONS[reaction.risk];

  const projected = useMemo(
    () => project(0, dca, HORIZON, reaction.rate / 100).at(-1)?.valeur ?? 0,
    [dca, reaction.rate],
  );
  const verse = dca * 12 * HORIZON;

  const finish = (openAdd: boolean) => {
    if (openAdd) sessionStorage.setItem("patrimoine.openAdd", "1");
    const goal: Goal = {
      id: uid(),
      kind: "patrimoine",
      label: "Patrimoine cible",
      amount: Math.round(projected / 10000) * 10000,
      horizon: HORIZON,
      dca,
      rate: reaction.rate,
    };
    onDone({
      name: name.trim() || "Investisseur",
      age: 0,
      profession: "",
      incomeMonthly: 0,
      riskProfile: reaction.risk,
      goal: { amount: goal.amount, horizon: goal.horizon, dca: goal.dca },
      goals: [goal],
      activeGoalId: goal.id,
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-14">
      <div className="mb-10 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
              i <= step ? "bg-primary" : "bg-elevated"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="fade-up flex flex-1 flex-col">
          <h1 className="font-display text-[2.5rem] leading-[1.05] tracking-tight">
            Tout ton
            <br />
            patrimoine,
            <br />
            <span className="text-primary">une seule vue.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            Bourse, livrets, immobilier, crédits. Cours à jour, allocation
            réelle, projections. Rien ne quitte ton téléphone.
          </p>
          <label className="mt-auto block pt-10">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">
              Comment tu t'appelles ?
            </span>
            <input
              value={name}
              placeholder="Alex"
              autoComplete="given-name"
              onChange={(e) => setName(e.target.value)}
              className="h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg outline-none focus:border-primary"
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">
            Ton portefeuille perd 20 %.
            <br />
            Tu fais quoi ?
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ta réaction détermine ton allocation cible.
          </p>
          <div className="mt-6 space-y-2.5">
            {REACTIONS.map((r) => {
              const on = risk === r.risk;
              return (
                <button
                  key={r.risk}
                  type="button"
                  onClick={() => setRisk(r.risk)}
                  className={`tap w-full rounded-2xl border p-4 text-left transition-colors ${
                    on ? "border-primary bg-primary/[0.06]" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold leading-snug">{r.label}</span>
                    {on && (
                      <span className="mt-0.5 shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {RISK_LABELS[r.risk]}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.detail}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fade-up flex flex-1 flex-col">
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">
            Si tu plaçais chaque mois…
          </h1>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {DCA_CHOICES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDca(v)}
                className={`tap rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  dca === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {v} €
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/[0.06] p-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Dans {HORIZON} ans, profil {RISK_LABELS[reaction.risk].toLowerCase()}
            </p>
            <p className="mt-2 font-display text-[2.75rem] leading-none tracking-tight text-primary">
              {eur(projected)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              dont {eur(projected - verse)} d'intérêts composés, pour {eur(verse)} versés
            </p>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Hypothèse : {reaction.rate} %/an, l'allocation cible de ton profil
            ({target.actions} % actions · {target.obligations} % fonds € ·{" "}
            {target.immo} % immo · {target.cash} % cash). C'est ton premier
            objectif — ajustable à tout moment.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-2.5">
        {step < 2 ? (
          <button
            type="button"
            disabled={step === 1 && !risk}
            onClick={() => setStep((s) => s + 1)}
            className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-30"
          >
            Continuer <ArrowRight className="size-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => finish(true)}
              className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground"
            >
              <Plus className="size-4" /> Ajouter ma première ligne
            </button>
            <button
              type="button"
              onClick={() => finish(false)}
              className="tap h-12 w-full rounded-2xl text-sm font-semibold text-muted-foreground"
            >
              Explorer d'abord
            </button>
          </>
        )}

        {step === 0 && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-muted-foreground"
            >
              <Upload className="size-4" /> J'ai déjà une sauvegarde
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                restoreBackup(f).catch((err) =>
                  setRestoreError(err instanceof Error ? err.message : "Import impossible."),
                );
              }}
            />
            {restoreError && (
              <p className="text-center text-[11px] text-destructive">{restoreError}</p>
            )}
          </>
        )}

        {step > 0 && step < 2 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="tap h-11 w-full text-sm font-medium text-muted-foreground"
          >
            Retour
          </button>
        )}
      </div>
    </div>
  );
}
