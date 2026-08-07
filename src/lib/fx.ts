/**
 * Conversion des montants en euros.
 *
 * Principe : les montants sont stockés dans leur devise d'origine et
 * convertis au moment du calcul. L'inverse — convertir à la saisie —
 * réécrirait l'historique à chaque variation de taux.
 *
 * Les taux (BCE, une publication par jour ouvré) sont mis en cache
 * localement pour que l'app reste juste hors ligne.
 */

const CACHE_KEY = "patrimoine.fx";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface FxSnapshot {
  date: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

let current: FxSnapshot | null = null;

function readCache(): FxSnapshot | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxSnapshot;
    return parsed.rates && typeof parsed.rates === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Taux connus, éventuellement périmés. */
export function fxSnapshot(): FxSnapshot | null {
  if (!current && typeof window !== "undefined") current = readCache();
  return current;
}

/**
 * Convertit un montant vers l'euro. Sans taux connu pour la devise,
 * le montant est renvoyé tel quel — mieux vaut une valeur non convertie
 * qu'un zéro silencieux, et l'app signale ces lignes par ailleurs.
 */
export function toEur(amount: number, currency?: string | number): number {
  const code = String(currency ?? "EUR").toUpperCase();
  if (!code || code === "EUR") return amount;
  const rate = fxSnapshot()?.rates[code];
  return rate && rate > 0 ? amount / rate : amount;
}

/** La devise est-elle convertible avec les taux disponibles ? */
export function canConvert(currency?: string | number): boolean {
  const code = String(currency ?? "EUR").toUpperCase();
  if (!code || code === "EUR") return true;
  const rate = fxSnapshot()?.rates[code];
  return Boolean(rate && rate > 0);
}

/** Rafraîchit les taux si le cache local a plus de douze heures. */
export async function ensureFxRates(): Promise<void> {
  if (typeof window === "undefined") return;
  const cached = fxSnapshot();
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS) return;

  try {
    const res = await fetch("/api/public/fx");
    if (!res.ok) return;
    const json = (await res.json()) as { date: string; rates: Record<string, number> };
    if (!json.rates || !Object.keys(json.rates).length) return;
    const snap: FxSnapshot = {
      date: json.date,
      rates: json.rates,
      fetchedAt: new Date().toISOString(),
    };
    current = snap;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    // Hors ligne : on garde les derniers taux connus.
  }
}
