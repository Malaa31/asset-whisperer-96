/**
 * Service worker minimal.
 *
 * Objectif : que l'app s'ouvre hors ligne. Les données vivent déjà dans
 * le stockage local, seule la coquille a besoin d'être mise en cache.
 *
 * Point d'attention : une version antérieure gardait indéfiniment les
 * ressources en cache et ne se renouvelait jamais, si bien qu'un nouveau
 * déploiement restait invisible. D'où deux garde-fous :
 *  - la navigation passe toujours par le réseau d'abord ;
 *  - le cache ne sert de repli qu'en cas d'échec réseau, et il est purgé
 *    à chaque activation d'une nouvelle version.
 */

const CACHE = "patrimoine-shell";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/manifest.webmanifest"]).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Purge complète : les noms de fichiers changent à chaque
      // déploiement, garder l'ancien contenu n'a aucun intérêt.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation : réseau d'abord, cache en secours hors ligne uniquement.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Ressources : réseau d'abord également. Leur nom est versionné, mais
  // ce choix garantit qu'aucune version périmée ne survit à un déploiement.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r ?? Response.error())),
  );
});
