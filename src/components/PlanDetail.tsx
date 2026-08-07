import { useState } from "react";
import { Info, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { eur } from "@/lib/format";
import { RISK_LABELS, TARGET_ALLOCATIONS, type Profile } from "@/lib/types";
import { PlanEditor } from "./PlanEditor";

export interface PlanLineView {
  emoji: string;
  label: string;
  tag: string;
  amount: number;
}

/** Feuille dédiée au plan du mois : lignes, base expliquée derrière (i), Ajuster. */
export function PlanDetail({
  plan,
  dca,
  profile,
  saveProfile,
  onClose,
}: {
  plan: PlanLineView[];
  dca: number;
  profile: Profile;
  saveProfile: (p: Profile) => void;
  onClose: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const risk = profile.riskProfile;
  const t = TARGET_ALLOCATIONS[risk];
  const custom = Boolean(profile.planLines?.length);

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
        <h2 className="font-display text-lg">Plan du mois</h2>
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="Comment ce plan est calculé"
          className={`tap flex size-9 items-center justify-center rounded-full ${
            showInfo ? "bg-primary/12 text-primary" : "bg-elevated"
          }`}
        >
          <Info className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-2xl">{eur(dca)}</div>
            <p className="text-xs text-muted-foreground">à répartir ce mois-ci</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
          >
            <Pencil className="size-3" /> Ajuster
          </button>
        </div>

        {showInfo && (
          <div className="mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            {custom
              ? "Répartition personnalisée : chaque ligne reçoit son poids en % du versement. « Ajuster » pour la modifier ou revenir au plan conseillé."
              : `Plan conseillé, dérivé de l'allocation cible de ton profil ${RISK_LABELS[risk].toLowerCase()} : ${t.actions} % actions (60 % Monde, 25 % Europe, 15 % small caps), ${t.obligations} % fonds €, ${t.immo} % immobilier papier, ${t.cash} % cash de précaution. Modifiable librement via « Ajuster ».`}
          </div>
        )}

        <ul className="mt-5 space-y-3">
          {plan.map((p) => (
            <li key={p.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{p.emoji}</span>
                  <span className="truncate">{p.label}</span>
                  <span className="rounded bg-elevated px-1.5 py-0.5 num text-[10px] text-muted-foreground">
                    {p.tag}
                  </span>
                </span>
                <span className="num text-sm">{eur(p.amount)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(p.amount / Math.max(1, dca)) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <PlanEditor
          lines={profile.planLines}
          risk={risk}
          onClose={() => setEditing(false)}
          onSave={(lines) => {
            const { planLines: _drop, ...rest } = profile;
            saveProfile(lines ? { ...rest, planLines: lines } : rest);
            setEditing(false);
            toast.success(lines ? "Plan personnalisé enregistré" : "Plan conseillé rétabli");
          }}
        />
      )}
    </div>
  );
}
