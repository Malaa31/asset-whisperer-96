import { fetchQuote } from "./market";
import type { Asset } from "./types";

/** Lignes dont le cours peut être récupéré automatiquement. */
function pricedAssets(assets: Asset[]): Asset[] {
  return assets.filter(
    (a) => (a.type === "pea" || a.type === "crypto") && String(a.data["ticker"] ?? "").trim(),
  );
}

/** Clé portant le cours courant selon le type de ligne. */
export function priceKey(type: Asset["type"]): string {
  return type === "crypto" ? "prixUnitaire" : "currentPrice";
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
 * Récupère les cours et renvoie la liste mise à jour,
 * ou null si rien n'a changé (aucun ticker, réseau indisponible…).
 */
export async function refreshPrices(assets: Asset[]): Promise<Asset[] | null> {
  const priced = pricedAssets(assets);
  if (!priced.length) return null;

  const quotes = await fetchQuote(priced.map((a) => String(a.data["ticker"])));
  if (!Object.keys(quotes).length) return null;

  const stamp = new Date().toISOString();
  let changed = false;
  const next = assets.map((a) => {
    const q = quotes[String(a.data["ticker"] ?? "")];
    if (!q) return a;
    changed = true;
    return {
      ...a,
      data: { ...a.data, [priceKey(a.type)]: q.price, lastPriceUpdate: stamp },
      updatedAt: stamp,
    };
  });
  return changed ? next : null;
}

/** Un rafraîchissement automatique par tranche de 4 heures. */
const AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** Les cours sont-ils assez anciens pour justifier une actualisation auto ? */
export function pricesAreStale(assets: Asset[]): boolean {
  if (!pricedAssets(assets).length) return false;
  const last = lastPriceUpdate(assets);
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > AUTO_INTERVAL_MS;
}
