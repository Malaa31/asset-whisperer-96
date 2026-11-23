import { compactHistory } from "../history";
import type { HistoryPoint } from "../storage";

const DAY = 86_400_000;
let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const point = (day: number, value = day): HistoryPoint => ({
  date: new Date(day * DAY).toISOString(),
  value,
});
const sameDays = (points: HistoryPoint[]) => points.map((item) => item.date.slice(0, 10));

console.log("\nHISTORIQUE COMPACTÉ");
const fixedNow = new Date("2026-11-23T12:00:00.000Z");
const nowDay = Math.floor(fixedNow.getTime() / DAY);
const sameDay = [point(nowDay, 1), point(nowDay, 2)];
check(
  "les doublons du jour gardent la dernière valeur",
  compactHistory(sameDay, fixedNow)[0]?.value === 2,
);

const range = Array.from({ length: 5 * 365 }, (_, index) => point(nowDay - 5 * 365 + index));
const compacted = compactHistory(range, fixedNow);
const recent = compacted.filter((item) => Date.parse(item.date) >= fixedNow.getTime() - 90 * DAY);
const middle = compacted.filter((item) => {
  const t = Date.parse(item.date);
  return t < fixedNow.getTime() - 90 * DAY && t >= fixedNow.getTime() - 2 * 365.25 * DAY;
});
const old = compacted.filter(
  (item) => Date.parse(item.date) < fixedNow.getTime() - 2 * 365.25 * DAY,
);
check("90 derniers jours conservés au quotidien", recent.length >= 89 && recent.length <= 91);
check("période 90 jours–2 ans compactée par semaine", middle.length >= 90 && middle.length <= 110);
check("au-delà de 2 ans compacté par mois", old.length >= 30 && old.length <= 65);
check(
  "compaction idempotente",
  JSON.stringify(compacted) === JSON.stringify(compactHistory(compacted, fixedNow)),
);
check("cinq ans de données quotidiennes restent bornés", compacted.length < 300);

const sixty = Array.from({ length: 60 }, (_, index) => point(nowDay - 59 + index));
check(
  "historique existant de 60 points inchangé",
  JSON.stringify(compactHistory(sixty, fixedNow)) === JSON.stringify(sixty),
);
check(
  "sortie chronologique",
  sameDays(compacted).join() === [...sameDays(compacted)].sort().join(),
);

console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
if (failures) process.exitCode = 1;
