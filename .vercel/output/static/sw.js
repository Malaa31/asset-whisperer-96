/**
 * Service worker minimal.
 *
 * Objectif : que l'app s'ouvre hors ligne. Les données vivent déjà dans
 * le stockage local, seule la coquille a besoin d'être mise en cache.
 *
 * Stratégie « réseau d'abord » pour la navigation : on sert toujours la
 * version à jour quand la connexion le permet, et le cache prend le
 * relais sinon. Les appels API ne sont jamais mis en cache ici — leur
 * fraîcheur est gérée par les en-têtes côté serveur.
 */

const CACHE = "patrimoine-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Ressources versionnées (JS, CSS, images) : le cache d'abord suffit,
  // leur nom change à chaque déploiement.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
