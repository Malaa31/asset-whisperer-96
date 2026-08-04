import { useRef, useState } from "react";
import { Sparkles, Search, ShieldCheck, Calculator, Upload, Plus, ArrowRight } from "lucide-react";
import { RISK_LABELS, TARGET_ALLOCATIONS, type Profile, type RiskProfile } from "@/lib/types";
import { restoreBackup } from "@/lib/backup";

const FEATURES = [
  { Icon: Sparkles, title: "Multi-actifs", text: "Bourse, AV, immo, crypto, crédits" },
  { Icon: Search, title: "Recherche live", text: "Cours à jour en un tap" },
  { Icon: ShieldCheck, title: "Protection", text: "Jauges de risque en transparence" },
  { Icon: Calculator, title: "Simulateurs", text: "Crédit & capacité d'emprunt" },
];

/**
 * Question concrète plutôt que jargon : la réaction à une baisse de 20 %
 * est le meilleur révélateur du profil de risque réel.
 */
const REACTIONS: Array<{ risk: RiskProfile; label: string; detail: string }> = [
  { risk: "prudent", label: "Je vends pour limiter la casse", detail: "La sécurité d'abord" },
  { risk: "equilibre", label: "Je réduis un peu, ça m'inquiète", detail: "Croissance, mais sans stress" },
  { risk: "dynamique", label: "J'attends, ça finira par remonter", detail: "Le long terme est mon allié" },
  { risk: "offensif", label: "J'en profite pour renforcer", detail: "Les baisses sont des soldes" },
];

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [restoreError, setRestoreError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [risk, setRisk] = useState<RiskProfile | null>(null);

  const finish = (firstAdd: boolean) => {
    if (firstAdd) sessionStorage.setItem("patrimoine.openAdd", "1");
    onDone({
      name: name.trim() || "Investisseur",
      age: 0,
      profession: "",
      incomeMonthly: 0,
      riskProfile: risk ?? "equilibre",
      goal: { amount: 0, horizon: 10, dca: 0 },
      goals: [],
    });
  };

  const target = risk ? TARGET_ALLOCATIONS[risk] : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-5 pb-8 pt-10">
      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      {step === 0 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-3xl leading-tight">Pilote ton patrimoine.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Une seule vérité chiffrée : tous tes actifs et tes dettes au même endroit,
            sur ton appareil.
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
          <label className="mt-6 block">
            <span className="mb-1 block text-xs text-muted-foreground">Ton prénom</span>
            <input
              value={name}
              placeholder="Alex"
              onChange={(e) => setName(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="fade-up flex-1">
          <h1 className="font-display text-2xl leading-snug">
            Ton portefeuille perd 20 % en quelques mois. Tu fais quoi ?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ta réaction détermine ton profil d'investisseur — modifiable à tout
            moment dans Profil.
          </p>
          <div className="mt-5 space-y-3">
            {REACTIONS.map((r) => {
              const t = TARGET_ALLOCATIONS[r.risk];
              const selected = risk === r.risk;
              return (
                <button
                  key={r.risk}
                  type="button"
                  onClick={() => setRisk(r.risk)}
                  className={`tap card-surface w-full p-4 text-left ${selected ? "border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{r.label}</span>
                    {selected && (
                      <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {RISK_LABELS[r.risk]}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{r.detail}</div>
                  {selected && (
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                      <span className="bg-primary" style={{ width: `${t.actions}%` }} />
                      <span className="bg-info" style={{ width: `${t.obligations}%` }} />
                      <span className="bg-orange" style={{ width: `${t.immo}%` }} />
                      <span className="bg-muted-foreground" style={{ width: `${t.cash}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {target && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Allocation cible : {target.actions} % actions · {target.obligations} % fonds € ·{" "}
              {target.immo} % immo · {target.cash} % cash.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="fade-up flex flex-1 flex-col">
          <h1 className="font-display text-2xl">C'est prêt, {name.trim() || "toi"}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajoute ta première ligne — un ETF, un livret, ton bien immobilier —
            et ton patrimoine prend forme. Le reste (âge, revenu, objectifs) se
            règle plus tard, dans Profil.
          </p>
          <div className="card-surface mt-6 p-4">
            <div className="text-xs text-muted-foreground">Ton profil</div>
            <div className="mt-1 font-display text-xl">
              {RISK_LABELS[risk ?? "equilibre"]}
            </div>
            {target && (
              <div className="mt-2 flex h-2 overflow-hidden rounded-full">
                <span className="bg-primary" style={{ width: `${target.actions}%` }} />
                <span className="bg-info" style={{ width: `${target.obligations}%` }} />
                <span className="bg-orange" style={{ width: `${target.immo}%` }} />
                <span className="bg-muted-foreground" style={{ width: `${target.cash}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {step < 2 && (
        <button
          type="button"
          disabled={step === 1 && !risk}
          onClick={() => setStep((s) => s + 1)}
          className="tap mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          Continuer <ArrowRight className="size-4" />
        </button>
      )}

      {step === 2 && (
        <>
          <button
            type="button"
            onClick={() => finish(true)}
            className="tap mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" /> Ajouter ma première ligne
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            className="tap mt-3 w-full rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground"
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
            className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground"
          >
            <Upload className="size-4" /> Restaurer une sauvegarde
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
            <p className="mt-2 text-center text-[11px] text-destructive">{restoreError}</p>
          )}
        </>
      )}
    </div>
  );
}
