/**
 * Version du build, injectée à la compilation.
 *
 * Sert à lever toute ambiguïté sur la version réellement servie :
 * quand un écran semble ne pas avoir changé, cette valeur dit
 * immédiatement si l'appareil exécute le dernier déploiement ou une
 * copie retenue en cache.
 */
export const BUILD_ID: string =
  (import.meta.env["VITE_BUILD_ID"] as string | undefined) ?? "dev";

export const BUILD_DATE: string =
  (import.meta.env["VITE_BUILD_DATE"] as string | undefined) ?? "";
