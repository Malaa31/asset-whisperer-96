import { useState } from "react";
import { Sparkles, Search, ShieldCheck, Calculator } from "lucide-react";
import { RISK_LABELS, TARGET_ALLOCATIONS, type Profile, type RiskProfile } from "@/lib/types";
import { eur } from "@/lib/format";

const FEATURES = [
  { Icon: Sparkles, title: "Multi-actifs", text: "Bourse, AV, immo, crypto, crédits" },
  { Icon: Search, title: "Recherche live", text: "Cours à jour en un tap" },
  { Icon: ShieldCheck, title: "Protection", text: "Jauges de risque en transparence" },
  { Icon: Calculator, title: "Simulateurs", text: "Crédit & capacité d'emprunt" },
];

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("35");
  const [profession, setProfession] = useState("");
  const [income, setIncome] = useState("3000");
  const [risk, setRisk] = useState<RiskProfile>("equilibre");
  const [amount, setAmount] = useState("300000");
  const [horizon, setHorizon] = useState("15");
  const [dca, setDca] = useState("500");

  const next = () => setStep((s) => s + 1);
  const finish = () =>
    onDone({
      name: name.trim() || "Investisseur",
      age: Number(age) || 0,
      profession,
      incomeMonthly: Number(income) || 0,
      riskProfile: risk,
      goal: { amount: Number(amount) || 0, horizon: Number(horizon) || 10, dca: Number(dca) || 0 },
    });

  const target = TARGET_ALLOCATIONS[risk];

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-5 pb-8 pt-10">
      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${((step + 1) / 4) * 100}%` }}
        />
      </div>

      {step === 0 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-3xl leading-tight">Pilote ton patrimoine.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Une seule vérité chiffrée : tous tes actifs et tes dettes au même endroit.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="card-surface p-3">
                <Icon className="size-4 text-primary" />
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <div className="text-[11px] text-muted-foreground">{text}</div>
              </div>
            ))}
          </div>
          <Field label="Ton prénom" value={name} onChange={setName} placeholder="Alex" />
        </div>
      )}

      {step === 1 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-2xl">Ton profil</h1>
          <Field label="Âge" value={age} onChange={setAge} numeric />
          <Field label="Profession" value={profession} onChange={setProfession} />
          <Field label="Revenu net mensuel (€)" value={income} onChange={setIncome} numeric />
        </div>
      )}

      {step === 2 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-2xl">Ta tolérance au risque</h1>
          <div className="mt-4 space-y-3">
            {(Object.keys(TARGET_ALLOCATIONS) as RiskProfile[]).map((r) => {
              const t = TARGET_ALLOCATIONS[r];
              const selected = risk === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  className={`tap card-surface w-full p-4 text-left ${selected ? "border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{RISK_LABELS[r]}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.actions}% actions
                    </span>
                  </div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                    <span className="bg-primary" style={{ width: `${t.actions}%` }} />
                    <span className="bg-info" style={{ width: `${t.obligations}%` }} />
                    <span className="bg-orange" style={{ width: `${t.immo}%` }} />
                    <span className="bg-muted-foreground" style={{ width: `${t.cash}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-2xl">Ton objectif</h1>
          <Field label="Montant cible (€)" value={amount} onChange={setAmount} numeric />
          <Field label="Horizon (années)" value={horizon} onChange={setHorizon} numeric />
          <Field label="Versement mensuel (€)" value={dca} onChange={setDca} numeric />
          <div className="card-surface mt-5 p-4">
            <div className="text-xs text-muted-foreground">Récapitulatif</div>
            <div className="mt-1 font-display text-2xl">{eur(Number(amount) || 0)}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              dans {horizon} ans · {eur(Number(dca) || 0)}/mois · profil {RISK_LABELS[risk]} (
              {target.actions}% actions)
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={step === 3 ? finish : next}
        className="tap mt-8 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
      >
        {step === 3 ? "Entrer dans l'app" : "Continuer"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder ?? ""}
        inputMode={numeric ? "decimal" : "text"}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
