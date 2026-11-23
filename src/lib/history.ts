import type { HistoryPoint } from "./storage";

const DAY_MS = 86_400_000;
const NINETY_DAYS_MS = 90 * DAY_MS;
const TWO_YEARS_MS = 2 * 365.25 * DAY_MS;

/** Compacts an unlimited daily net-worth history without changing its values. */
/** Merges two histories by keeping the newest timestamp for each day, then compacts them. */
export function mergeHistory(
  a: HistoryPoint[],
  b: HistoryPoint[],
  now = new Date(),
): HistoryPoint[] {
  return compactHistory([...a, ...b], now);
}

export function compactHistory(points: HistoryPoint[], now = new Date()): HistoryPoint[] {
  const sorted = points
    .filter((point) => Number.isFinite(Date.parse(point.date)) && Number.isFinite(point.value))
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const latestPerDay = new Map<string, HistoryPoint>();
  for (const point of sorted) {
    latestPerDay.set(new Date(point.date).toISOString().slice(0, 10), point);
  }

  const dailyBoundary = now.getTime() - NINETY_DAYS_MS;
  const weeklyBoundary = now.getTime() - TWO_YEARS_MS;
  const selected = new Map<string, HistoryPoint>();

  for (const point of latestPerDay.values()) {
    const date = new Date(point.date);
    const timestamp = date.getTime();
    const dayKey = date.toISOString().slice(0, 10);
    if (timestamp >= dailyBoundary) {
      selected.set(`day:${dayKey}`, point);
    } else if (timestamp >= weeklyBoundary) {
      selected.set(`week:${isoWeekKey(date)}`, point);
    } else {
      selected.set(`month:${dayKey.slice(0, 7)}`, point);
    }
  }

  return [...selected.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function isoWeekKey(date: Date): string {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${thursday.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}
