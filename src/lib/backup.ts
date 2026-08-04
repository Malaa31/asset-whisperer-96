import { KEYS, storage, type HistoryPoint } from "./storage";
import type { Asset, Profile } from "./types";
import { REMINDER_SEEN_KEY } from "./reminder";

/**
 * Sauvegarde/restauration : tout l'état (profil, actifs, historique)
 * dans un fichier JSON daté. Permet de changer d'appareil ou de se
 * prémunir d'une perte de données (localStorage effacé).
 */

export interface BackupFile {
  app: "patrimoine";
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  assets: Asset[];
  history: HistoryPoint[];
}

export function exportBackup(): void {
  const profile = storage.get<Profile>(KEYS.profile);
  const stamp = new Date().toISOString();
  if (profile) {
    profile.lastBackup = stamp;
    storage.set(KEYS.profile, profile);
  }
  const payload: BackupFile = {
    app: "patrimoine",
    version: 1,
    exportedAt: stamp,
    profile,
    assets: storage.get<Asset[]>(KEYS.assets) ?? [],
    history: storage.get<HistoryPoint[]>(KEYS.history) ?? [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `patrimoine-${stamp.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  // Recharge pour refléter lastBackup dans l'UI.
  window.location.reload();
}

/** Restaure une sauvegarde puis recharge l'app. Lance une erreur si invalide. */
export async function restoreBackup(file: File): Promise<void> {
  // Une sauvegarde réaliste pèse quelques dizaines de kilooctets.
  // Au-delà, on refuse plutôt que de bloquer le navigateur sur un
  // JSON.parse de plusieurs mégaoctets.
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Fichier trop volumineux pour être une sauvegarde Patrimoine.");
  }

  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (parsed.app !== "patrimoine" || !Array.isArray(parsed.assets)) {
    throw new Error("Fichier non reconnu : ce n'est pas une sauvegarde Patrimoine.");
  }
  // Le fichier vient de l'utilisateur : on ne recopie que des lignes
  // de forme attendue, plutôt que de faire confiance à sa structure.
  const assets = parsed.assets.filter(isPlausibleAsset);
  if (parsed.assets.length && !assets.length) {
    throw new Error("Aucune ligne exploitable dans ce fichier.");
  }

  if (parsed.profile && isPlausibleProfile(parsed.profile)) {
    storage.set(KEYS.profile, parsed.profile);
  } else {
    storage.remove(KEYS.profile);
  }
  storage.set(KEYS.assets, assets);
  storage.set(KEYS.history, Array.isArray(parsed.history) ? parsed.history : []);
  // Le rappel du mois repart à zéro : la sauvegarde importée fait foi.
  storage.remove(REMINDER_SEEN_KEY);
  window.location.reload();
}

export function daysSinceBackup(profile: Profile | null): number | undefined {
  if (!profile?.lastBackup) return undefined;
  return Math.floor((Date.now() - new Date(profile.lastBackup).getTime()) / 86400000);
}

const ASSET_TYPES = ["pea", "av", "livret", "immo", "crypto", "cash", "autre", "credit"];

/** Contrôle de forme minimal d'une ligne importée. */
function isPlausibleAsset(a: unknown): a is Asset {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  return (
    typeof o["id"] === "string" &&
    typeof o["type"] === "string" &&
    ASSET_TYPES.includes(o["type"]) &&
    typeof o["data"] === "object" &&
    o["data"] !== null &&
    !Array.isArray(o["data"])
  );
}

function isPlausibleProfile(p: unknown): p is Profile {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return typeof o["name"] === "string" && (o["goals"] === undefined || Array.isArray(o["goals"]));
}
