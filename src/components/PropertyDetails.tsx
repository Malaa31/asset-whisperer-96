import { eur, rawPct } from "@/lib/format";
import { loanSummary } from "@/lib/loans";
import { n } from "@/lib/calc";
import { rentalSummary } from "@/lib/rental";
import type { Asset } from "@/lib/types";

export function PropertyDetails({
  property,
  assets,
  compact = false,
}: {
  property: Asset;
  assets: Asset[];
  compact?: boolean;
}) {
  const linkedCredits = assets.filter(
    (item) => item.type === "credit" && item.data["bienId"] === property.id,
  );
  const valeur = Math.max(0, n(property.data["valeurEstimee"]));
  const creditsRestants = linkedCredits.reduce(
    (sum, credit) => sum + loanSummary(credit.data).restant,
    0,
  );
  const mensualites = linkedCredits.reduce(
    (sum, credit) => sum + loanSummary(credit.data).mensualiteActuelle,
    0,
  );
  const tauxEndettement = valeur > 0 ? (creditsRestants / valeur) * 100 : 0;
  const rent = n(property.data["loyer"]) > 0 ? rentalSummary(property, linkedCredits) : null;
  const propertyName = String(property.data["name"] ?? property.data["type"] ?? "Bien immobilier");

  return (
    <section
      aria-label={`Détails du bien ${propertyName}`}
      className={`rounded-xl border border-border bg-elevated/50 ${compact ? "mt-3 p-3" : "mt-1 p-4"}`}
    >
      <h3 className="text-xs font-semibold text-muted-foreground">Situation du bien</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
        <Metric label="Valeur estimée" value={eur(valeur)} />
        <Metric label="Crédit restant" value={eur(creditsRestants)} />
        <Metric label="Valeur nette" value={eur(valeur - creditsRestants)} accent />
        <Metric label="Endettement du bien" value={rawPct(tauxEndettement, 1)} />
        <Metric label="Mensualités totales" value={`${eur(mensualites)}/mois`} />
      </dl>

      {rent && (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="text-xs font-semibold">Rentabilité <span className="font-normal text-muted-foreground">· avant impôts</span></h4>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
            <Metric
              label="Cash-flow mensuel"
              value={`${eur(rent.cashFlowMensuel)}/mois`}
              tone={rent.cashFlowMensuel >= 0 ? "success" : "destructive"}
            />
            <Metric label="Rendement brut" value={rawPct(rent.rendementBrut, 1)} />
            <Metric label="Net de charges · avant crédit" value={rawPct(rent.rendementNetCharges, 1)} />
            <Metric label="Loyer après vacance" value={`${eur(rent.loyerNetVacance)}/mois`} />
          </dl>
        </div>
      )}

      {linkedCredits.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="text-xs font-semibold">Crédits liés</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {linkedCredits.map((credit) => {
              const summary = loanSummary(credit.data);
              return (
                <li key={credit.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {String(credit.data["name"] ?? credit.data["type"] ?? "Crédit")}
                  </span>
                  <span className="shrink-0 text-right num">
                    {eur(summary.restant)}
                    <span className="ml-1 text-muted-foreground">· {eur(summary.mensualiteActuelle)}/mois</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  accent = false,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "success" | "destructive";
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate num text-xs font-semibold ${accent ? "text-primary" : toneClass}`}>{value}</dd>
    </div>
  );
}
