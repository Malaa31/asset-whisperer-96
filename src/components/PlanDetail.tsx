import { useState } from "react";
import { Info, X } from "lucide-react";
import { eur } from "@/lib/format";
import { SIGNAL_LABELS, VERDICT_LABELS, type Analysis } from "@/lib/signals";
import { BUFFER_MONTHS, type PlanResult } from "@/lib/plan";
import { RISK_LABELS, type Profile } from "@/lib/types";

/**
 * Feuille du plan du mois : seul endroit où lire le classement.
 * Les lignes viennent du portefeuille — on renforce ce qu'on détient
 * déjà, en priorité ce qui a le mieux travaillé au regard du risque.
 */
export function PlanDetail({
  plan,
  dca,
  profile,
  analyses,
  onClose,
}: {
  plan: PlanResult;
  dca: number;
  profile: Profile;
  analyses: Map<string, Analysis>;
  onClose: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const { buffer } = plan;

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
        </p>

        {showInfo && (
          <p className="mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            Le plan ne propose que des lignes que vous détenez déjà, classées par
            leur rapport rendement/risque passé (performance annualisée, Sharpe,
            pire baisse) et leur tendance actuelle. Les lignes en signal Alléger
            sont écartées. L'épargne de précaution n'est alimentée que tant
            qu'elle reste sous {BUFFER_MONTHS} mois de revenus. Ces indicateurs
            décrivent le passé et ne constituent pas un conseil en investissement.
          </p>
        )}

        {buffer.months !== undefined && (
          <div
            className={`mt-4 rounded-xl border p-3 text-[11px] leading-relaxed ${
              buffer.sufficient
                ? "border-primary/30 bg-primary/[0.06]"
                : "border-amber/40 bg-amber/10"
            }`}
          >
            Épargne de précaution : {eur(buffer.amount)}, soit{" "}
            <span className="font-semibold">{buffer.months.toFixed(1)} mois</span> de
            revenus.
            {buffer.sufficient
              ? ` Au-delà de ${BUFFER_MONTHS} mois, elle sort du plan : le versement va entièrement aux placements.`
              : ` Une part du versement continue de l'alimenter jusqu'à ${BUFFER_MONTHS} mois.`}
          </div>
        )}

        {buffer.months === undefined && (
          <p className="mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            Renseignez vos revenus dans Profil pour que l'épargne de précaution
            soit prise en compte.
          </p>
        )}

        {plan.note && <p className="mt-4 text-sm text-muted-foreground">{plan.note}</p>}

        <ul className="mt-5 space-y-2.5">
          {plan.lines.map((l) => {
            const a = analyses.get(l.assetId);
            return (
              <li key={l.assetId} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{l.label}</p>
                    {a && (
                      <>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {a.cagr.toFixed(1)} %/an · vol. {a.volatility.toFixed(0)} % ·{" "}
                          {SIGNAL_LABELS[a.signal]}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold">
                          {VERDICT_LABELS[a.verdict]}
                          {a.alpha !== undefined && (
                            <span className="ml-1.5 num font-normal text-muted-foreground">
                              alpha {a.alpha > 0 ? "+" : ""}
                              {a.alpha.toFixed(1)} %/an
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {a.verdictReason}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm font-semibold">{eur(l.amount)}</p>
                    <p className="num text-[11px] text-muted-foreground">
                      {l.weight} %{a ? ` · score ${l.score}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${l.weight}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">
          Répartition calculée sur des données passées. Elle ne préjuge pas des
          performances futures et ne constitue pas un conseil en investissement.
        </p>
      </div>
    </div>
  );
}
