import { webcrypto } from "node:crypto";
import {
  decryptBackup,
  deriveVaultKey,
  encryptBackup,
  randomBase64Url,
  toBase64Url,
} from "../vault-crypto";
import {
  handleVaultRequest,
  VaultStoreConflictError,
  type VaultStoredRecord,
  type VaultStore,
} from "../vault-server";
import type { BackupFile } from "../backup";
import { shouldShowVaultConflict } from "../vault-conflict";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const backup: BackupFile = {
  app: "patrimoine",
  version: 1,
  exportedAt: "2026-11-23T00:00:00.000Z",
  profile: null,
  assets: [],
  history: [],
};
const responseJson = async (response: Response) =>
  response.json() as Promise<Record<string, unknown>>;

async function run() {
  console.log("\nDÉCISION DE CONFLIT DU COFFRE");
  check(
    "les changements limités à l'historique ne créent pas de conflit",
    !shouldShowVaultConflict("base", "remote-assets", "base"),
  );
  check(
    "un changement réel sur un seul appareil ne crée pas de conflit",
    !shouldShowVaultConflict("local-assets", "base", "base"),
  );
  check(
    "deux changements divergents de profil ou d'actifs créent un conflit",
    shouldShowVaultConflict("local-assets", "remote-assets", "base"),
  );
  check(
    "deux appareils ayant les mêmes changements ne créent pas de conflit",
    !shouldShowVaultConflict("same-change", "same-change", "base"),
  );

  console.log("\nCHIFFREMENT DU COFFRE");
  const vaultId = randomBase64Url(16);
  const salt = randomBase64Url(16);
  const key = await deriveVaultKey("phrase secrète assez longue", salt);
  const first = await encryptBackup(key, backup, vaultId, salt);
  const second = await encryptBackup(key, backup, vaultId, salt);
  check(
    "aller-retour chiffrer/déchiffrer",
    JSON.stringify(await decryptBackup(key, first, vaultId)) === JSON.stringify(backup),
  );
  check(
    "une mauvaise phrase secrète échoue",
    await deriveVaultKey("autre phrase secrète valide", salt).then((wrong) =>
      decryptBackup(wrong, first, vaultId).then(
        () => false,
        () => true,
      ),
    ),
  );
  const corrupted = {
    ...first,
    ciphertext: toBase64Url(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    ),
  };
  check(
    "un texte chiffré altéré échoue",
    await decryptBackup(key, corrupted, vaultId).then(
      () => false,
      () => true,
    ),
  );
  check("chaque enregistrement utilise un IV différent", first.iv !== second.iv);

  console.log("\nAPI DU COFFRE");
  const records = new Map<string, VaultStoredRecord>();
  let etagSequence = 0;
  const store: VaultStore = {
    async get(path) {
      return records.get(path) ?? null;
    },
    async put(path, value, expectedEtag) {
      const current = records.get(path);
      if ((current?.etag ?? null) !== expectedEtag) throw new VaultStoreConflictError();
      records.set(path, { value, etag: `etag-${++etagSequence}` });
    },
    async delete(path) {
      records.delete(path);
    },
  };
  const secret = randomBase64Url(32);
  const makePut = (expectedVersion?: number, envelope = first) =>
    new Request("https://app.test/api/vault", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vaultId,
        writeSecret: secret,
        envelope,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }),
    });
  const created = await handleVaultRequest(makePut(), store);
  check(
    "première écriture crée la version 1",
    created.status === 200 && (await responseJson(created))["version"] === 1,
  );

  const wrong = await handleVaultRequest(
    new Request(`https://app.test/api/vault?vaultId=${vaultId}`, {
      headers: { "x-vault-secret": randomBase64Url(32) },
    }),
    store,
  );
  check("un secret invalide renvoie 403", wrong.status === 403);

  const updated = await handleVaultRequest(makePut(1, second), store);
  check(
    "une écriture valide incrémente la version",
    updated.status === 200 && (await responseJson(updated))["version"] === 2,
  );
  const conflict = await handleVaultRequest(makePut(1), store);
  check(
    "une version attendue obsolète renvoie 409",
    conflict.status === 409 && (await responseJson(conflict))["version"] === 2,
  );

  const fetched = await handleVaultRequest(
    new Request(`https://app.test/api/vault?vaultId=${vaultId}`, {
      headers: { "x-vault-secret": secret },
    }),
    store,
  );
  const fetchedBody = await responseJson(fetched);
  check(
    "GET renvoie la version et l'enveloppe",
    fetched.status === 200 && fetchedBody["version"] === 2 && Boolean(fetchedBody["envelope"]),
  );

  const meta = await handleVaultRequest(
    new Request(`https://app.test/api/vault?vaultId=${vaultId}&meta=1`, {
      headers: { "x-vault-secret": secret },
    }),
    store,
  );
  const metaBody = await responseJson(meta);
  check(
    "GET meta ne renvoie que version et date",
    meta.status === 200 && Object.keys(metaBody).sort().join() === "updatedAt,version",
  );

  const deleted = await handleVaultRequest(
    new Request(`https://app.test/api/vault?vaultId=${vaultId}`, {
      method: "DELETE",
      headers: { "x-vault-secret": secret },
    }),
    store,
  );
  const missing = await handleVaultRequest(
    new Request(`https://app.test/api/vault?vaultId=${vaultId}`, {
      headers: { "x-vault-secret": secret },
    }),
    store,
  );
  check("DELETE authentifié supprime le coffre", deleted.status === 200 && missing.status === 404);

  console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
  if (failures) process.exitCode = 1;
}

void run();
