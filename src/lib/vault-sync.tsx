import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { BackupFile } from "./backup";
import { mergeHistory } from "./history";
import { shouldShowVaultConflict } from "./vault-conflict";
import {
  clearVaultKey,
  createVaultIdentity,
  decryptBackup,
  deriveVaultKey,
  encryptBackup,
  getVaultKey,
  readVaultIdentity,
  saveVaultKey,
  storeVaultIdentity,
  VAULT_LOCAL_KEY,
  type VaultEnvelope,
  type VaultIdentity,
} from "./vault-crypto";

const SAFETY_COPY_KEY = "patrimoine.vault.safety";

type Conflict = { version: number; updatedAt: string } | null;
type SyncStatus = "idle" | "syncing" | "saved" | "offline" | "error" | "conflict";

interface VaultApi {
  identity: VaultIdentity | null;
  code: string | null;
  status: SyncStatus;
  initialSyncDone: boolean;
  lastSyncAt: string | null;
  conflict: Conflict;
  activate: (passphrase: string) => Promise<void>;
  uploadNow: () => Promise<void>;
  importFromCode: (code: string, passphrase: string) => Promise<void>;
  disableHere: () => Promise<void>;
  deleteVault: () => Promise<void>;
  resolveConflict: (choice: "local" | "remote") => Promise<void>;
}

const VaultContext = createContext<VaultApi | null>(null);

export function useVault(): VaultApi {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault must be used within VaultProvider");
  return value;
}

export function VaultProvider({
  children,
  ready,
  backup,
  applyBackup,
  onInitialSyncDone,
}: {
  children: ReactNode;
  ready: boolean;
  backup: BackupFile;
  applyBackup: (backup: BackupFile) => void;
  onInitialSyncDone: () => void;
}) {
  const [identity, setIdentity] = useState<VaultIdentity | null>(() => readVaultIdentity());
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const uploadNowRef = useRef<() => Promise<void>>(async () => undefined);
  const syncOnOpenRef = useRef<() => Promise<void>>(async () => undefined);
  const skipNextOpen = useRef(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [initialSyncDone, setInitialSyncDone] = useState(() => !identity?.enabled);
  const markInitialSyncDone = useCallback(() => {
    setInitialSyncDone(true);
    onInitialSyncDone();
  }, [onInitialSyncDone]);
  const [conflict, setConflict] = useState<Conflict>(null);
  const backupRef = useRef(backup);
  const previousSignature = useRef("");
  const ignoreNextSignature = useRef<string | null>(null);
  backupRef.current = backup;

  const updateIdentity = useCallback((next: VaultIdentity | null) => {
    identityRef.current = next;
    setIdentity(next);
    if (next) storeVaultIdentity(next);
    else if (typeof window !== "undefined") window.localStorage.removeItem(VAULT_LOCAL_KEY);
  }, []);

  const apiUrl = (vaultId: string, meta = false) =>
    `/api/vault?vaultId=${encodeURIComponent(vaultId)}${meta ? "&meta=1" : ""}`;

  const uploadNow = useCallback(async () => {
    const active = identityRef.current;
    if (!active?.enabled) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("syncing");
    try {
      const key = await getVaultKey();
      if (!key) throw new Error("Clé locale indisponible.");
      const snapshot = backupRef.current;
      const snapshotSignature = dataSignature(snapshot);
      const snapshotHash = await hashProfileAssets(snapshot);
      const envelope = await encryptBackup(key, snapshot, active.vaultId, active.salt);
      const response = await fetch("/api/vault", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vaultId: active.vaultId,
          writeSecret: active.writeSecret,
          envelope,
          expectedVersion: active.lastRemoteVersion,
        }),
      });
      if (response.status === 409) {
        setStatus("syncing");
        window.setTimeout(() => void syncOnOpenRef.current(), 0);
        return;
      }
      if (!response.ok) throw new Error("Synchronisation impossible.");
      const result = (await response.json()) as { version: number; updatedAt: string };
      const changedDuringUpload = dataSignature(backupRef.current) !== snapshotSignature;
      const saved: VaultIdentity = {
        ...active,
        dirty: changedDuringUpload,
        lastRemoteVersion: result.version,
        lastSyncAt: result.updatedAt,
        lastSyncedDataHash: snapshotHash,
      };
      updateIdentity(saved);
      setConflict(null);
      setStatus(changedDuringUpload ? "syncing" : "saved");
      if (changedDuringUpload) window.setTimeout(() => void uploadNowRef.current(), 10_000);
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [updateIdentity]);

  const fetchRemote = useCallback(
    async (active: VaultIdentity): Promise<{ version: number; envelope: VaultEnvelope }> => {
      const response = await fetch(apiUrl(active.vaultId), {
        headers: { "x-vault-secret": active.writeSecret },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Coffre inaccessible.");
      return (await response.json()) as { version: number; envelope: VaultEnvelope };
    },
    [],
  );

  const applyRemote = useCallback(
    async (
      active: VaultIdentity,
      version: number,
      envelope?: VaultEnvelope,
      forceRemote = false,
    ) => {
      const remote = envelope ? { version, envelope } : await fetchRemote(active);
      const key = await getVaultKey();
      if (!key) throw new Error("Clé locale indisponible.");
      const restored = await decryptBackup(key, remote.envelope, active.vaultId);
      const current = backupRef.current;
      const localDataHash = await hashProfileAssets(current);
      const remoteDataHash = await hashProfileAssets(restored);
      if (
        !forceRemote &&
        shouldShowVaultConflict(localDataHash, remoteDataHash, active.lastSyncedDataHash)
      ) {
        setConflict({ version: remote.version, updatedAt: remote.envelope.updatedAt });
        setStatus("conflict");
        return;
      }
      const keepLocalData =
        !forceRemote &&
        Boolean(active.lastSyncedDataHash) &&
        localDataHash !== active.lastSyncedDataHash &&
        remoteDataHash === active.lastSyncedDataHash;
      const merged: BackupFile = {
        ...(keepLocalData ? current : restored),
        history: mergeHistory(current.history, restored.history),
      };
      const shouldUpload = dataSignature(merged) !== dataSignature(restored);
      window.localStorage.setItem(SAFETY_COPY_KEY, JSON.stringify(current));
      const updated: VaultIdentity = {
        ...active,
        dirty: shouldUpload,
        lastRemoteVersion: remote.version,
        lastSyncAt: remote.envelope.updatedAt,
        lastSyncedDataHash: remoteDataHash,
      };
      updateIdentity(updated);
      if (!shouldUpload && dataSignature(merged) !== dataSignature(current)) {
        ignoreNextSignature.current = dataSignature(merged);
      }
      applyBackup(merged);
      window.setTimeout(() => window.localStorage.removeItem(SAFETY_COPY_KEY), 11_000);
      toast.success("Données mises à jour depuis le coffre", {
        duration: 10_000,
        action: {
          label: "Annuler",
          onClick: () => {
            try {
              const safety = JSON.parse(
                window.localStorage.getItem(SAFETY_COPY_KEY) ?? "null",
              ) as BackupFile | null;
              if (!safety) return;
              ignoreNextSignature.current = dataSignature(safety);
              applyBackup(safety);
              updateIdentity({ ...updated, dirty: true });
              window.localStorage.removeItem(SAFETY_COPY_KEY);
              setTimeout(() => void uploadNow(), 10_000);
            } catch {
              toast.error("La copie de sécurité est illisible.");
            }
          },
        },
      });
    },
    [applyBackup, fetchRemote, updateIdentity, uploadNow],
  );

  const syncOnOpen = useCallback(async () => {
    const active = identity;
    if (!active?.enabled) return;
    if (!navigator.onLine) {
      if (active.dirty) setStatus("offline");
      return;
    }
    try {
      const response = await fetch(apiUrl(active.vaultId, true), {
        headers: { "x-vault-secret": active.writeSecret },
        cache: "no-store",
      });
      if (response.status === 404) {
        if (active.dirty) await uploadNow();
        return;
      }
      if (!response.ok) throw new Error("Coffre inaccessible.");
      const meta = (await response.json()) as { version: number; updatedAt: string };
      if (meta.version > active.lastRemoteVersion) {
        const remote = await fetchRemote(active);
        await applyRemote(active, remote.version, remote.envelope);
        return;
      }
      if (active.dirty) await uploadNow();
      else setStatus("saved");
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [applyRemote, fetchRemote, identity, uploadNow]);

  const activate = useCallback(
    async (passphrase: string) => {
      const next = createVaultIdentity();
      const key = await deriveVaultKey(passphrase, next.salt);
      await saveVaultKey(key);
      skipNextOpen.current = true;
      updateIdentity(next);
      await uploadNow();
    },
    [updateIdentity, uploadNow],
  );

  const importFromCode = useCallback(
    async (code: string, passphrase: string) => {
      const [vaultId, writeSecret, extra] = code.trim().split(".");
      if (!vaultId || !writeSecret || extra) throw new Error("Code de synchronisation invalide.");
      const temporary: VaultIdentity = {
        vaultId,
        writeSecret,
        salt: "",
        lastSyncAt: null,
        lastRemoteVersion: 0,
        dirty: false,
        enabled: true,
      };
      const remote = await fetchRemote(temporary);
      const salt = remote.envelope.kdf.salt;
      const key = await deriveVaultKey(passphrase, salt);
      const restored = await decryptBackup(key, remote.envelope, vaultId);
      const current = backupRef.current;
      const merged: BackupFile = {
        ...restored,
        history: mergeHistory(current.history, restored.history),
      };
      const remoteDataHash = await hashProfileAssets(restored);
      const shouldUpload = dataSignature(merged) !== dataSignature(restored);
      await saveVaultKey(key);
      skipNextOpen.current = true;
      const linked: VaultIdentity = {
        ...temporary,
        salt,
        lastRemoteVersion: remote.version,
        lastSyncAt: remote.envelope.updatedAt,
        lastSyncedDataHash: remoteDataHash,
        dirty: shouldUpload,
      };
      window.localStorage.setItem(SAFETY_COPY_KEY, JSON.stringify(current));
      updateIdentity(linked);
      if (!shouldUpload && dataSignature(merged) !== dataSignature(current)) {
        ignoreNextSignature.current = dataSignature(merged);
      }
      applyBackup(merged);
      window.setTimeout(() => window.localStorage.removeItem(SAFETY_COPY_KEY), 11_000);
      toast.success("Coffre ajouté à cet appareil", {
        duration: 10_000,
        action: {
          label: "Annuler",
          onClick: () => {
            try {
              const safety = JSON.parse(
                window.localStorage.getItem(SAFETY_COPY_KEY) ?? "null",
              ) as BackupFile | null;
              if (!safety) return;
              ignoreNextSignature.current = dataSignature(safety);
              applyBackup(safety);
              updateIdentity({ ...linked, dirty: true });
              window.localStorage.removeItem(SAFETY_COPY_KEY);
              window.setTimeout(() => void uploadNowRef.current(), 10_000);
            } catch {
              toast.error("La copie de sécurité est illisible.");
            }
          },
        },
      });
    },
    [applyBackup, fetchRemote, updateIdentity],
  );

  const disableHere = useCallback(async () => {
    updateIdentity(null);
    setConflict(null);
    setStatus("idle");
    await clearVaultKey();
  }, [updateIdentity]);

  const deleteVault = useCallback(async () => {
    const active = identity;
    if (!active) return;
    const response = await fetch(apiUrl(active.vaultId), {
      method: "DELETE",
      headers: { "x-vault-secret": active.writeSecret },
    });
    if (!response.ok) throw new Error("Suppression du coffre impossible.");
    await disableHere();
  }, [disableHere, identity]);

  const resolveConflict = useCallback(
    async (choice: "local" | "remote") => {
      const active = identity;
      const remoteVersion = conflict?.version;
      if (!active || !remoteVersion) return;
      setConflict(null);
      if (choice === "remote") {
        try {
          const remote = await fetchRemote(active);
          await applyRemote(active, remote.version, remote.envelope, true);
        } catch {
          setStatus("error");
        }
        return;
      }
      try {
        const remote = await fetchRemote(active);
        const key = await getVaultKey();
        if (!key) throw new Error("Clé locale indisponible.");
        const remoteBackup = await decryptBackup(key, remote.envelope, active.vaultId);
        const current = backupRef.current;
        const merged: BackupFile = {
          ...current,
          history: mergeHistory(current.history, remoteBackup.history),
        };
        const remoteDataHash = await hashProfileAssets(remoteBackup);
        updateIdentity({
          ...active,
          dirty: true,
          lastRemoteVersion: remote.version,
          lastSyncAt: remote.envelope.updatedAt,
          lastSyncedDataHash: remoteDataHash,
        });
        backupRef.current = merged;
        ignoreNextSignature.current = dataSignature(merged);
        applyBackup(merged);
        void uploadNow();
      } catch {
        setStatus("error");
      }
    },
    [applyBackup, applyRemote, conflict, fetchRemote, identity, updateIdentity, uploadNow],
  );

  useEffect(() => {
    if (!ready) return;
    const signature = dataSignature(backup);
    if (!previousSignature.current) {
      previousSignature.current = signature;
      return;
    }
    if (previousSignature.current === signature) return;
    previousSignature.current = signature;
    if (ignoreNextSignature.current === signature) {
      ignoreNextSignature.current = null;
      return;
    }
    const active = identityRef.current;
    if (!active?.enabled) return;
    const dirtyIdentity = { ...active, dirty: true };
    updateIdentity(dirtyIdentity);
    setStatus(navigator.onLine ? "syncing" : "offline");
    const timer = window.setTimeout(() => void uploadNowRef.current(), 10_000);
    return () => window.clearTimeout(timer);
  }, [backup, ready, updateIdentity]);

  syncOnOpenRef.current = syncOnOpen;
  uploadNowRef.current = uploadNow;

  useEffect(() => {
    if (!ready) return;
    if (!identity?.enabled) {
      markInitialSyncDone();
      return;
    }
    if (!navigator.onLine) {
      if (identity.dirty) setStatus("offline");
      markInitialSyncDone();
    } else {
      const skipInitialSync = skipNextOpen.current;
      skipNextOpen.current = false;
      if (skipInitialSync) markInitialSyncDone();
      else void syncOnOpenRef.current().finally(markInitialSyncDone);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncOnOpenRef.current();
    };
    const onOnline = () =>
      void (identityRef.current?.dirty ? uploadNowRef.current() : syncOnOpenRef.current());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [identity?.enabled, ready, markInitialSyncDone]);

  const value = useMemo<VaultApi>(
    () => ({
      identity,
      code: identity ? `${identity.vaultId}.${identity.writeSecret}` : null,
      status,
      initialSyncDone,
      lastSyncAt: identity?.lastSyncAt ?? null,
      conflict,
      activate,
      uploadNow,
      importFromCode,
      disableHere,
      deleteVault,
      resolveConflict,
    }),
    [
      identity,
      status,
      initialSyncDone,
      conflict,
      activate,
      uploadNow,
      importFromCode,
      disableHere,
      deleteVault,
      resolveConflict,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

function dataSignature(backup: BackupFile): string {
  return JSON.stringify({
    profile: backup.profile,
    assets: backup.assets,
    history: backup.history,
  });
}

async function hashProfileAssets(backup: BackupFile): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ profile: backup.profile, assets: backup.assets }),
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
