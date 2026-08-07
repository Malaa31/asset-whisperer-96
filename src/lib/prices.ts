import { fetchQuote } from "./market";
import type { Asset } from "./types";

/**
 * Actualisation des cours.
 *
 * Regroupée ici pour que l'accueil et le rafraîchissement automatique
 * partagent exactement la même logique, et qu'une correction profite
 * aux deux.
 */

/** Clé portant le cours courant selon le type de ligne. */
export function priceKey(type: Asset["type"]): string {
  return type === "crypto" ? "prixUnitaire" : "currentPrice";
}

/** Lignes dont le cours peut être récupéré automatiquement. */
export function pricedAssets(assets: Asset[]): Asset[] {
  return assets.filter(
    (a) => (a.type === "pea" || a.type === "crypto") && String(a.data["ticker"] ?? "").trim(),
  );
}

/** Horodatage de la dernière récupération, toutes lignes confondues. */
export function lastPriceUpdate(assets: Asset[]): string | undefined {
  const stamps = assets
    .map((a) => a.data["lastPriceUpdate"])
    .filter(Boolean)
    .map(String)
    .sort();
  return stamps[stamps.length - 1];
}

/**
 * Récupère les cours et renvoie la liste mise à jour, ou null si rien
 * n'a changé : aucun ticker, réseau indisponible, cotation inchangée.
 * Ne lève jamais — un échec de cours ne doit pas casser l'écran.
 */
export async function refreshPrices(assets: Asset[]): Promise<Asset[] | null> {
  const priced = pricedAssets(assets);
  if (!priced.length) return null;

  let quotes: Record<string, { price: number }> = {};
  try {
    quotes = await fetchQuote(priced.map((a) => String(a.data["ticker"])));
  } catch {
    return null;
  }
  if (!Object.keys(quotes).length) return null;

  const stamp = new Date().toISOString();
  let changed = false;
  const next = assets.map((a) => {
    const q = quotes[String(a.data["ticker"] ?? "")];
    if (!q?.price) return a;
    changed = true;
    return {
      ...a,
      data: { ...a.data, [priceKey(a.type)]: q.price, lastPriceUpdate: stamp },
      updatedAt: stamp,
    };
  });
  return changed ? next : null;
}

/** Au-delà de quatre heures, les cours méritent d'être rafraîchis. */
const AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function pricesAreStale(assets: Asset[]): boolean {
  if (!pricedAssets(assets).length) return false;
  const last = lastPriceUpdate(assets);
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > AUTO_INTERVAL_MS;
}
