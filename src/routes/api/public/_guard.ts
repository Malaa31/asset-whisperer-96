/**
 * Garde-fou des routes publiques.
 *
 * Ces routes relaient des services tiers (cours, historique, recherche).
 * Sans filtre, elles servent de proxy gratuit à n'importe qui.
 *
 * Un compteur en mémoire n'aurait aucun sens ici : chaque instance
 * serverless a la sienne et redémarre à froid. La limitation de débit se
 * règle au niveau de l'hébergeur — sur Vercel, une règle de pare-feu sur
 * /api/public/*. Ce module couvre le complément applicatif : n'accepter
 * que les requêtes issues de l'application elle-même.
 *
 * L'en-tête Origin se falsifie, donc cela n'arrête pas un attaquant
 * déterminé ; cela suffit contre l'usage opportuniste depuis un autre
 * site, qui est le scénario réaliste.
 */

const EXTRA_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Navigation directe ou même origine : pas d'en-tête Origin envoyé.
  if (!origin) return true;
  try {
    const self = new URL(request.url).origin;
    if (origin === self || EXTRA_ORIGINS.includes(origin)) return true;
    // Aperçus de déploiement du même projet.
    return /\.(vercel\.app|lovable\.app)$/.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json({ error: "origin_not_allowed" }, { status: 403 });
}
