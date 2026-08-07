/**
 * Service worker neutralisé.
 *
 * La version précédente servait les ressources depuis son cache en
 * priorité. Comme elle mettait aussi ce fichier en cache, elle empêchait
 * l'installation de son propre correctif : les déploiements restaient
 * invisibles sans intervention manuelle sur l'appareil.
 *
 * Ce fichier ne fait donc plus qu'une chose : purger les caches, se
 * désinscrire et recharger les pages ouvertes. L'app redevient une
 * application web classique, toujours installable sur l'écran d'accueil
 * grâce au manifeste, mais sans couche de cache qui puisse la figer.
 */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
