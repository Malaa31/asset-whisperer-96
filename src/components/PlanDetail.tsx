import { useState } from "react";
import { Check, Info, Minus, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { eur } from "@/lib/format";
import { SIGNAL_LABELS, type Analysis } from "@/lib/signals";
import { BUFFER_MONTHS, POCKET_LABELS, isPlanCandidate, type PlanResult } from "@/lib/plan";
import { RISK_LABELS, type Asset, type Profile } from "@/lib/types";

/**
 * Feuille du plan du mois.
 *
 * Volontairement sobre : chaque ligne tient en deux informations, le
 * montant et une qualification courte. Les critères — performance
 * ajustée du risque, tendance, concentration, adéquation au profil —
 * travaillent en arrière-plan et ne sont pas détaillés à l'écran.
 *
 * La répartition calculée peut être remplacée par une saisie manuelle,
 * et le calcul repris à tout moment.
 */
export function PlanDetail({
  plan,
  dca,
  profile,
  analyses,
  assets,
  onToggle,
  onWeights,
  onClose,
}: {
  plan: PlanResult;
  dca: number;
  profile: Profile;
  analyses: Map<string, Analysis>;
  assets: Asset[];
  onToggle: (assetId: string) => void;
  onWeights: (weights: Record<string, number> | null) => void;
  onClose: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const excluded = profile.planExcluded ?? [];
  const inPlan = new Set(plan.lines.map((l) => l.assetId));
  // Seules les lignes cotées peuvent entrer au plan : un livret ou une
  // assurance vie n'a pas d'historique à analyser, il n'a rien à faire ici.
  const others = assets.filter((a) => isPlanCandidate(a) && !inPlan.has(a.id));

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
          aria-label="Méthode de calcul"
          onClick={() => setShowInfo((s) => !s)}
          className={`tap flex size-9 items-center justify-center rounded-full ${
            showInfo ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"
          }`}
        >
          <Info className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <p className="font-display text-[2rem] leading-none">{eur(dca)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          à répartir ce mois-ci · profil {RISK_LABELS[profile.riskProfile].toLowerCase()}
          {plan.manual ? " · répartition personnalisée" : ""}
        </p>

        {showInfo && (
          <p className="mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            La répartition ne porte que sur des lignes que vous détenez déjà.
            Elle tient compte de la performance passée rapportée au risque, de la
            tendance récente, de la place actuelle de chaque ligne dans le
            portefeuille et de son adéquation à votre profil. Vous pouvez retirer
            une ligne, en ajouter une, ou fixer vous-même les pourcentages. Ces
            indicateurs décrivent le passé et ne constituent pas un conseil en
            investissement.
          </p>
        )}

        {buffer(plan, BUFFER_MONTHS)}

        {plan.pockets.length > 0 && !plan.manual && (
          <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Vers votre allocation cible
            </p>
            <ul className="mt-2 space-y-2">
              {plan.pockets.map((x) => (
                <li key={x.pocket} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[12px]">{POCKET_LABELS[x.pocket]}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                      style={{ width: `${Math.min(100, x.current)}%` }}
                    />
                    <span
                      className="absolute inset-y-0 w-0.5 bg-foreground"
                      style={{ left: `${Math.min(100, x.target)}%` }}
                    />
                  </span>
                  <span className="num w-24 shrink-0 text-right text-[11px] text-muted-foreground">
                    {x.current.toFixed(0)} % / {x.target} %
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Le trait marque la cible de votre profil. Le versement va en
              priorité aux poches en retard, sans jamais vendre. À l'intérieur
              d'une poche, les lignes sont pondérées en transparence : un ETF
              Monde contenant déjà des actions européennes et américaines, le
              plan évite de doubler une zone déjà bien représentée.
            </p>
          </div>
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

        {plan.note && <p className="mt-3 text-sm text-muted-foreground">{plan.note}</p>}

        <ul className="mt-3 space-y-2.5">
          {plan.lines.map((l) => {
            const a = analyses.get(l.assetId);
            return (
              <li key={l.assetId} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{l.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {POCKET_LABELS[l.pocket]}
                      {a ? ` · ${SIGNAL_LABELS[a.signal].toLowerCase()}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm font-semibold">{eur(l.amount)}</p>
                    {editing ? (
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          inputMode="decimal"
                          value={draft[l.assetId] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [l.assetId]: e.target.value }))
                          }
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
                {a && !editing && (
                  <button
                    type="button"
                    onClick={() => onToggle(l.assetId)}
                    className="tap mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                  >
                    <Minus className="size-3" /> Retirer
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {editing && (
          <p
            className={`mt-3 text-center num text-[11px] ${
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
              {others.map((a) => {
                const an = analyses.get(a.id);
                const isExcluded = excluded.includes(a.id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px]">{String(a.data["name"] ?? "Ligne")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isExcluded
                          ? "Retirée du plan"
                          : an
                            ? SIGNAL_LABELS[an.signal]
                            : "Analyse indisponible"}
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
                );
              })}
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

/** Encart sur l'épargne de précaution, affiché seulement s'il apporte quelque chose. */
function buffer(plan: PlanResult, months: number) {
  const b = plan.buffer;
  if (b.months === undefined) {
    return (
      <p className="mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
        Renseignez vos revenus dans Profil pour que l'épargne de précaution soit
        prise en compte.
      </p>
    );
  }
  return (
    <div
      className={`mt-4 rounded-xl border p-3 text-[11px] leading-relaxed ${
        b.sufficient ? "border-primary/30 bg-primary/[0.06]" : "border-amber/40 bg-amber/10"
      }`}
    >
      Épargne de précaution : {b.months.toFixed(1)} mois de revenus.
      {b.sufficient
        ? " Le versement va entièrement aux placements."
        : ` Une part l'alimente jusqu'à ${months} mois.`}
    </div>
  );
}
