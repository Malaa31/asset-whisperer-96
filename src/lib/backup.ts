import { KEYS, storage, type HistoryPoint } from "./storage";
import type { Asset, Profile } from "./types";

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
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (parsed.app !== "patrimoine" || !Array.isArray(parsed.assets)) {
    throw new Error("Fichier non reconnu : ce n'est pas une sauvegarde Patrimoine.");
  }
  if (parsed.profile) storage.set(KEYS.profile, parsed.profile);
  else storage.remove(KEYS.profile);
  storage.set(KEYS.assets, parsed.assets);
  storage.set(KEYS.history, Array.isArray(parsed.history) ? parsed.history : []);
  storage.set(KEYS.seeded, true); // ne pas re-injecter les données de démo
  window.location.reload();
}

export function daysSinceBackup(profile: Profile | null): number | undefined {
  if (!profile?.lastBackup) return undefined;
  return Math.floor((Date.now() - new Date(profile.lastBackup).getTime()) / 86400000);
}
