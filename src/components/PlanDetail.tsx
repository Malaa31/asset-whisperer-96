import { useState } from "react";
import { useLockScroll } from "@/lib/useLockScroll";
import { useModalBack } from "@/hooks/useModalBack";
import { Check, Info, Minus, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { eur } from "@/lib/format";
import { SIGNAL_LABELS, type Analysis } from "@/lib/signals";
import { CLASS_LABELS, isDestination, type PlanResult } from "@/lib/plan";
import type { PlanOutcome } from "@/lib/monthly-plan";
import { RISK_LABELS, type Asset, type Profile } from "@/lib/types";

/**
 * Feuille du plan du mois.
 *
 * Sobre à dessein : une ligne, un montant, une qualification courte. Les
 * critères — qualité passée, risque, tendance, diversification en
 * transparence, adéquation au profil — travaillent en arrière-plan.
 *
 * L'utilisateur garde la main : retirer une ligne, en ajouter une parmi
 * celles qu'il détient, ou fixer lui-même les pourcentages.
 */
export function PlanDetail({
  plan,
  dca,
  profile,
  analyses,
  outcome,
  assets,
  onToggle,
  onWeights,
  onClose,
}: {
  plan: PlanResult;
  dca: number;
  profile: Profile;
  analyses: Map<string, Analysis>;
  /** Sortie du moteur d'allocation : contraintes, concentration, détail. */
  outcome: PlanOutcome;
  assets: Asset[];
  onToggle: (assetId: string) => void;
  onWeights: (weights: Record<string, number> | null) => void;
  onClose: () => void;
}) {
  useLockScroll(true);
  useModalBack(onClose);
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const excluded = profile.planExcluded ?? [];
  const inPlan = new Set(plan.lines.map((l) => l.assetId));
  // Supports détenus, abondables, mais absents du plan : retirés à la
  // main, ou écartés par le modèle.
  const others = assets.filter((a) => isDestination(a) && !inPlan.has(a.id));

  const startEdit = () => {
    setDraft(Object.fromEntries(plan.lines.map((l) => [l.assetId, String(l.weight)])));
    setEditing(true);
  };

  const saveEdit = () => {
    const weights: Record<string, number> = {};
    for (const [id, v] of Object.entries(draft)) {
      const n = Number(v.replace(",", "."));
      if (Number.isFinite(n) && n > 0) weights[id] = n;
    }
    onWeights(Object.keys(weights).length ? weights : null);
    setEditing(false);
  };

  const draftTotal = Object.values(draft).reduce((s, v) => {
    const n = Number(v.replace(",", "."));
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-background">
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
          aria-label="Méthode"
          onClick={() => setShowInfo((s) => !s)}
          className={`tap flex size-9 items-center justify-center rounded-full ${
            showInfo ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"
          }`}
        >
          <Info className="size-4" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <p className="font-display text-[2rem] leading-none">{eur(dca)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          à répartir · profil {RISK_LABELS[profile.riskProfile].toLowerCase()}
          {plan.manual ? " · répartition personnalisée" : ""}
        </p>

        {showInfo && (
          <p className="mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            Le plan répartit le versement sur vos placements financiers, hors
            immobilier et livrets, vers les classes en retard sur votre cible.
            Ce n'est pas un conseil en investissement.
          </p>
        )}

        {plan.rationale.length > 0 && !plan.manual && (
          <div className="mt-4 rounded-xl bg-elevated p-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {plan.rationale[0]}
            </p>
          </div>
        )}

        {plan.note && <p className="mt-4 text-sm text-muted-foreground">{plan.note}</p>}

        {outcome.goal.message && (
          <p
            className={`mt-4 rounded-xl p-3 text-[11px] leading-relaxed ${
              outcome.goal.kind === "unrealistic"
                ? "border border-amber/40 bg-amber/10"
                : "bg-elevated text-muted-foreground"
            }`}
          >
            {outcome.goal.message}
          </p>
        )}

        {outcome.violations.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {outcome.violations.map((v) => (
              <li
                key={v.code}
                className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-[11px] leading-relaxed"
              >
                {v.message}
              </li>
            ))}
          </ul>
        )}

        {outcome.warnings.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {outcome.warnings.map((w) => (
              <li key={w} className="rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
                {w}
              </li>
            ))}
          </ul>
        )}


        <div className="mt-6 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Répartition
          </p>
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="tap text-[11px] font-semibold text-muted-foreground"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="tap flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"
              >
                <Check className="size-3" /> Valider
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {plan.manual && (
                <button
                  type="button"
                  onClick={() => onWeights(null)}
                  className="tap flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                >
                  <RotateCcw className="size-3" /> Recalculer
                </button>
              )}
              {plan.lines.length > 0 && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  <Pencil className="size-3" /> Ajuster
                </button>
              )}
            </div>
          )}
        </div>

        <ul className="mt-3 space-y-2.5">
          {plan.lines.map((l) => (
            <li key={l.assetId} className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{l.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {CLASS_LABELS[l.cls]}
                    {l.signal ? ` · ${SIGNAL_LABELS[l.signal].toLowerCase()}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-sm font-semibold">{eur(l.amount)}</p>
                  {editing ? (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        inputMode="decimal"
                        value={draft[l.assetId] ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [l.assetId]: e.target.value }))}
                        className="num h-8 w-14 rounded-lg border border-border bg-elevated px-2 text-right text-xs outline-none focus:border-primary"
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <p className="num text-[11px] text-muted-foreground">{l.weight} %</p>
                  )}
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${l.weight}%` }}
                />
              </div>
              {!editing && (() => {
                const detail = outcome.lines.find((o) => o.assetId === l.assetId);
                if (!detail || openLine !== l.assetId) return null;
                const rows: Array<[string, number]> = [
                  ["Convergence vers la cible", detail.breakdown.convergence],
                  ["Signal de marché", detail.breakdown.signal],
                  ["Pénalité de risque", detail.breakdown.risk],
                  ["Arrondi et frais", detail.breakdown.rounding],
                ];
                return (
                  <ul className="mt-2 space-y-1 border-t border-border pt-2">
                    {rows
                      .filter(([, v]) => v !== 0)
                      .map(([label, v]) => (
                        <li key={label} className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="num">
                            {v > 0 ? "+" : ""}
                            {v} €
                          </span>
                        </li>
                      ))}
                    <li className="flex justify-between border-t border-border pt-1 text-[11px] font-semibold">
                      <span>Total</span>
                      <span className="num">{detail.amount} €</span>
                    </li>
                  </ul>
                );
              })()}

              {!editing && (
                <div className="mt-2 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setOpenLine((v) => (v === l.assetId ? null : l.assetId))}
                    className="tap text-[11px] font-semibold text-muted-foreground"
                  >
                    {openLine === l.assetId ? "Masquer le détail" : "D'où vient ce montant ?"}
                  </button>
                </div>
              )}

              {!editing && (
                <button
                  type="button"
                  onClick={() => onToggle(l.assetId)}
                  className="tap mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                >
                  <Minus className="size-3" /> Retirer
                </button>
              )}
            </li>
          ))}
        </ul>

        {editing && (
          <p
            className={`num mt-3 text-center text-[11px] ${
              Math.round(draftTotal) === 100 ? "text-muted-foreground" : "text-amber"
            }`}
          >
            Total {Math.round(draftTotal)} %
            {Math.round(draftTotal) !== 100 && " — les montants seront proratisés"}
          </p>
        )}

        {others.length > 0 && !editing && (
          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Ajouter au plan
            </p>
            <ul className="mt-2 space-y-2">
              {others.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px]">{String(a.data["name"] ?? "Ligne")}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {excluded.includes(a.id) ? "Retirée du plan" : "Écartée par le calcul"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(a.id)}
                    className="tap flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary"
                  >
                    <Plus className="size-3" /> Ajouter
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-[10px] leading-relaxed text-muted-foreground">
          Répartition calculée sur des données passées. Elle ne préjuge pas des
          performances futures et ne constitue pas un conseil en investissement.
        </p>
      </div>
    </div>
  );
}
