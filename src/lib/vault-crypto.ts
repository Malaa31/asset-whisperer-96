import type { BackupFile } from "./backup";

export const VAULT_ITERATIONS = 600_000;
export const VAULT_LOCAL_KEY = "patrimoine.vault";
const KEY_DB = "patrimoine-vault-keys";
const KEY_STORE = "keys";
const KEY_NAME = "active";

export interface VaultEnvelope {
  v: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: 600000; salt: string };
  iv: string;
  ciphertext: string;
  updatedAt: string;
}

export interface VaultIdentity {
  vaultId: string;
  writeSecret: string;
  salt: string;
  lastSyncAt: string | null;
  lastRemoteVersion: number;
  dirty: boolean;
  enabled: boolean;
}

export function randomBase64Url(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

export function createVaultIdentity(salt = randomBase64Url(16)): VaultIdentity {
  return {
    vaultId: randomBase64Url(16),
    writeSecret: randomBase64Url(32),
    salt,
    lastSyncAt: null,
    lastRemoteVersion: 0,
    dirty: true,
    enabled: true,
  };
}

export async function deriveVaultKey(passphrase: string, salt: string): Promise<CryptoKey> {
  if (passphrase.length < 12)
    throw new Error("La phrase secrète doit contenir au moins 12 caractères.");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(fromBase64Url(salt)),
      iterations: VAULT_ITERATIONS,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(
  key: CryptoKey,
  backup: BackupFile,
  vaultId: string,
  salt: string,
  updatedAt = new Date().toISOString(),
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(new TextEncoder().encode(vaultId)),
    },
    key,
    toArrayBuffer(new TextEncoder().encode(JSON.stringify(backup))),
  );
  return {
    v: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: VAULT_ITERATIONS, salt },
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(encrypted)),
    updatedAt,
  };
}

export async function decryptBackup(
  key: CryptoKey,
  envelope: VaultEnvelope,
  vaultId: string,
): Promise<BackupFile> {
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(fromBase64Url(envelope.iv)),
      additionalData: toArrayBuffer(new TextEncoder().encode(vaultId)),
    },
    key,
    toArrayBuffer(fromBase64Url(envelope.ciphertext)),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as Partial<BackupFile>;
  if (
    parsed.app !== "patrimoine" ||
    !Array.isArray(parsed.assets) ||
    !Array.isArray(parsed.history)
  ) {
    throw new Error("Contenu du coffre invalide.");
  }
  return parsed as BackupFile;
}

export function storeVaultIdentity(identity: VaultIdentity): void {
  localStorage.setItem(VAULT_LOCAL_KEY, JSON.stringify(identity));
}

export function readVaultIdentity(): VaultIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(VAULT_LOCAL_KEY) ?? "null",
    ) as VaultIdentity | null;
    if (
      !parsed ||
      !parsed.enabled ||
      typeof parsed.vaultId !== "string" ||
      typeof parsed.writeSecret !== "string"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveVaultKey(key: CryptoKey): Promise<void> {
  await withKeyStore("readwrite", (store) => store.put(key, KEY_NAME));
}

export async function getVaultKey(): Promise<CryptoKey | null> {
  return (
    (await withKeyStore<CryptoKey | undefined>("readonly", (store) => store.get(KEY_NAME))) ?? null
  );
}

export async function clearVaultKey(): Promise<void> {
  await withKeyStore("readwrite", (store) => store.delete(KEY_NAME));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Encodage invalide.");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

function withKeyStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(KEY_DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(KEY_STORE);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB indisponible."));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(KEY_STORE, mode);
      const request = operation(transaction.objectStore(KEY_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Clé du coffre indisponible."));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Clé du coffre indisponible."));
    };
  });
}
