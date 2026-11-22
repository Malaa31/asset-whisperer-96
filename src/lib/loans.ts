import { mensualite } from "./calc";

export interface LoanScheduleRow {
  mois: number;
  date: string;
  echeance: number;
  interets: number;
  capital: number;
  restant: number;
}

export interface LoanSummary {
  restant: number;
  pctRembourse: number;
  dateFin: string | null;
  interetsRestants: number;
  mensualiteActuelle: number;
}

export type LoanData = Record<string, unknown>;

interface PaymentTier {
  debutMois: number;
  mensualite: number;
}

interface ScheduleSeed {
  debut: Date;
  duree: number;
  startIndex: number;
  capital: number;
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMonth(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value.trim());
  if (!match) return undefined;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, count: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function monthOffset(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
}

function parseTiers(value: unknown): PaymentTier[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      debutMois: numberValue(item?.debutMois) ?? 0,
      mensualite: numberValue(item?.mensualite) ?? 0,
    }))
    .filter((item) => Number.isInteger(item.debutMois) && item.debutMois > 0 && item.mensualite >= 0)
    .sort((a, b) => a.debutMois - b.debutMois);
}

export function isAutomaticLoan(credit: LoanData): boolean {
  const capital = numberValue(credit["capitalInitial"]);
  const duration = numberValue(credit["dureeMois"]);
  return (
    capital !== undefined && capital >= 0 &&
    duration !== undefined && Number.isInteger(duration) && duration > 0 &&
    Boolean(parseMonth(credit["dateDebut"]))
  );
}

function scheduleSeed(credit: LoanData): ScheduleSeed | undefined {
  if (!isAutomaticLoan(credit)) return undefined;
  const debut = parseMonth(credit["dateDebut"]);
  const duree = Math.floor(numberValue(credit["dureeMois"]) ?? 0);
  if (!debut || duree <= 0) return undefined;

  let startIndex = 1;
  let capital = Math.max(0, numberValue(credit["capitalInitial"]) ?? 0);
  const refDate = parseMonth(credit["refDate"]);
  const refCapital = numberValue(credit["refCapital"]);
  if (refDate && refCapital !== undefined && monthOffset(debut, refDate) >= 0) {
    startIndex = monthOffset(debut, refDate) + 2;
    capital = Math.max(0, refCapital);
  }
  return { debut, duree, startIndex, capital };
}

function paymentForMonth(credit: LoanData, month: number, duration: number): number {
  const tiers = parseTiers(credit["paliers"]);
  if (tiers.length) {
    let active: PaymentTier | undefined;
    for (const tier of tiers) {
      if (tier.debutMois > month) break;
      active = tier;
    }
    return active?.mensualite ?? 0;
  }
  const entered = numberValue(credit["mensualite"]);
  if (entered !== undefined) return Math.max(0, entered);
  const capital = Math.max(0, numberValue(credit["capitalInitial"]) ?? 0);
  const annualRate = numberValue(credit["taux"]) ?? 0;
  return mensualite(capital, annualRate, duration / 12);
}

function maxMonth(until: Date | string | number | undefined, seed: ScheduleSeed): number {
  if (until === undefined) return seed.duree;
  if (typeof until === "number") return Math.floor(until);
  const date = until instanceof Date
    ? new Date(Date.UTC(until.getFullYear(), until.getMonth(), 1))
    : parseMonth(until);
  if (!date || date < seed.debut) return 0;
  return Math.min(seed.duree, monthOffset(seed.debut, date) + 1);
}

/** Génère les échéances mensuelles, avec une éventuelle reprise sur relevé. */
export function buildSchedule(credit: LoanData, until?: Date | string | number): LoanScheduleRow[] {
  const seed = scheduleSeed(credit);
  if (!seed || seed.capital <= 0 || seed.startIndex > seed.duree) return [];
  const through = maxMonth(until, seed);
  if (through < seed.startIndex) return [];

  const annualRate = numberValue(credit["taux"]) ?? 0;
  const monthlyRate = annualRate / 100 / 12;
  const rows: LoanScheduleRow[] = [];
  let balance = seed.capital;

  for (let month = seed.startIndex; month <= through && balance > 0.005; month++) {
    const interest = balance * monthlyRate;
    const requestedPayment = paymentForMonth(credit, month, seed.duree);
    const payment = Math.min(requestedPayment, balance + interest);
    const principal = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - principal);
    if (balance < 0.005) balance = 0;
    rows.push({
      mois: month,
      date: monthKey(addMonths(seed.debut, month - 1)),
      echeance: payment,
      interets: interest,
      capital: principal,
      restant: balance,
    });
  }
  return rows;
}

/** Encours à une date donnée. Les crédits sans paramètres automatiques gardent leur solde manuel. */
export function remainingCapital(credit: LoanData, at: Date = new Date()): number {
  if (!isAutomaticLoan(credit)) return numberValue(credit["capitalRestant"]) ?? 0;
  const seed = scheduleSeed(credit);
  if (!seed) return numberValue(credit["capitalRestant"]) ?? 0;
  if (seed.capital <= 0 || seed.startIndex > seed.duree) return 0;

  const target = new Date(Date.UTC(at.getFullYear(), at.getMonth(), 1));
  const firstPayment = addMonths(seed.debut, seed.startIndex - 1);
  if (target < firstPayment) return seed.capital;
  const rows = buildSchedule(credit, target);
  return rows.length ? rows[rows.length - 1]!.restant : seed.capital;
}

/** Résumé du crédit à aujourd'hui, compatible avec les anciens crédits manuels. */
export function loanSummary(credit: LoanData): LoanSummary {
  const capitalInitial = Math.max(0, numberValue(credit["capitalInitial"]) ?? 0);
  const restant = remainingCapital(credit);
  const pctRembourse = capitalInitial > 0
    ? Math.max(0, Math.min(100, ((capitalInitial - restant) / capitalInitial) * 100))
    : 0;

  if (!isAutomaticLoan(credit)) {
    return {
      restant,
      pctRembourse,
      dateFin: typeof credit["dateFin"] === "string" ? credit["dateFin"] : null,
      interetsRestants: 0,
      mensualiteActuelle: Math.max(0, numberValue(credit["mensualite"]) ?? 0),
    };
  }

  const seed = scheduleSeed(credit)!;
  const schedule = buildSchedule(credit);
  const today = new Date();
  const currentMonth = monthKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const futureInterest = schedule
    .filter((row) => row.date >= currentMonth)
    .reduce((sum, row) => sum + row.interets, 0);
  const todayMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const currentIndex = monthOffset(seed.debut, todayMonth) + 1;
  const activeIndex = currentIndex < seed.startIndex ? 0 : currentIndex;
  const mensualiteActuelle = activeIndex > 0 && activeIndex <= seed.duree
    ? paymentForMonth(credit, activeIndex, seed.duree)
    : 0;
  const plannedEnd = monthKey(addMonths(seed.debut, seed.duree - 1));

  return {
    restant,
    pctRembourse,
    dateFin: schedule.at(-1)?.date ?? plannedEnd,
    interetsRestants: futureInterest,
    mensualiteActuelle,
  };
}
