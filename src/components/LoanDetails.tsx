import { useMemo } from "react";
import { eur, rawPct } from "@/lib/format";
import { buildSchedule, isAutomaticLoan, loanSummary, type LoanData } from "@/lib/loans";

export function LoanDetails({ credit }: { credit: LoanData }) {
  const automatic = isAutomaticLoan(credit);
  const schedule = useMemo(() => buildSchedule(credit), [credit]);
  if (!automatic) return null;

  const summary = loanSummary(credit);
  const groups = new Map<string, typeof schedule>();
  for (const row of schedule) {
    const year = row.date.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), row]);
  }
  const years = [...groups.entries()];
  const currentYear = String(new Date().getFullYear());
  const defaultOpenYear = years.some(([year]) => year === currentYear) ? currentYear : years.at(-1)?.[0];

  return (
    <section className="rounded-xl border border-border bg-elevated/50 p-4">
      <h3 className="text-sm font-semibold">Suivi du crédit</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Summary label="Capital restant" value={eur(summary.restant)} accent />
        <Summary label="Capital remboursé" value={rawPct(summary.pctRembourse, 1)} />
        <Summary label="Date de fin estimée" value={formatMonth(summary.dateFin)} />
        <Summary label="Intérêts restants" value={eur(summary.interetsRestants)} />
        <Summary label="Mensualité actuelle" value={`${eur(summary.mensualiteActuelle)}/mois`} />
      </dl>

      {years.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="mb-2 text-xs font-semibold">Échéancier par année</h4>
          <div className="flex flex-col gap-2">
            {years.map(([year, rows]) => (
              <details key={year} className="overflow-hidden rounded-lg border border-border bg-card" open={year === defaultOpenYear}>
                <summary className="tap cursor-pointer px-3 py-2 text-xs font-semibold">
                  {year} <span className="ml-1 font-normal text-muted-foreground">· {rows.length} échéances</span>
                </summary>
                <div className="max-h-64 overflow-auto border-t border-border">
                  <table className="w-full min-w-[420px] text-[10px]">
                    <thead className="sticky top-0 bg-card text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium">Mois</th>
                        <th className="px-2 py-2 text-right font-medium">Échéance</th>
                        <th className="px-2 py-2 text-right font-medium">Intérêts</th>
                        <th className="px-2 py-2 text-right font-medium">Capital</th>
                        <th className="px-2 py-2 text-right font-medium">Restant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.date}-${row.mois}`} className="border-t border-border/70">
                          <td className="px-2 py-2 capitalize">{formatMonth(row.date)}</td>
                          <td className="px-2 py-2 text-right num">{eur(row.echeance)}</td>
                          <td className="px-2 py-2 text-right num text-muted-foreground">{eur(row.interets)}</td>
                          <td className="px-2 py-2 text-right num">{eur(row.capital)}</td>
                          <td className="px-2 py-2 text-right num font-medium">{eur(row.restant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate num text-xs font-semibold ${accent ? "text-primary" : ""}`}>{value}</dd>
    </div>
  );
}

function formatMonth(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value ?? "—";
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}-01T00:00:00Z`));
}
