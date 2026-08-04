/**
 * Garde-fou des routes publiques.
 *
 * Ces routes relaient des services tiers (cours de bourse, taux de change).
 * Sans filtre, n'importe qui peut les utiliser comme proxy gratuit.
 *
 * Un compteur en mémoire ne servirait à rien ici : chaque instance
 * serverless a la sienne et redémarre à froid. La limitation de débit
 * se règle donc au niveau de l'hébergeur (Vercel Firewall : une règle
 * de type 60 requêtes/minute par IP sur /api/public/*).
 *
 * Ce module couvre le complément applicatif : n'accepter que les
 * requêtes issues de l'app elle-même. Contournable par un attaquant
 * déterminé — l'en-tête Origin se falsifie — mais suffisant contre
 * l'usage opportuniste depuis un autre site.
 */

/** Domaines autorisés en plus de celui qui sert la requête. */
const EXTRA_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Navigation directe ou même origine : pas d'en-tête Origin envoyé.
  if (!origin) return true;
  try {
    const self = new URL(request.url).origin;
    if (origin === self) return true;
    if (EXTRA_ORIGINS.includes(origin)) return true;
    // Aperçus de déploiement (vercel.app, lovable.app) du même projet.
    const host = new URL(origin).hostname;
    return /\.(vercel\.app|lovable\.app)$/.test(host);
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json({ error: "origin_not_allowed" }, { status: 403 });
}
