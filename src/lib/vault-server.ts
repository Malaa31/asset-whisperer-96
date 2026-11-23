import type { VaultEnvelope } from "./vault-crypto";

export const MAX_VAULT_BODY_BYTES = 2 * 1024 * 1024;

export interface VaultRecord {
  secretHash: string;
  version: number;
  envelope: VaultEnvelope;
}

export interface VaultStoredRecord {
  value: VaultRecord;
  etag: string;
}

export class VaultStoreConflictError extends Error {}

export interface VaultStore {
  get(pathname: string): Promise<VaultStoredRecord | null>;
  put(pathname: string, value: VaultRecord, expectedEtag: string | null): Promise<void>;
  delete(pathname: string): Promise<void>;
}

export async function handleVaultRequest(request: Request, store: VaultStore): Promise<Response> {
  try {
    const method = request.method.toUpperCase();
    if (method === "PUT") return await handlePut(request, store);
    if (method === "GET") return await handleGet(request, store);
    if (method === "DELETE") return await handleDelete(request, store);
    return json({ error: "method_not_allowed" }, 405);
  } catch {
    return json({ error: "request_failed" }, 500);
  }
}

async function handlePut(request: Request, store: VaultStore): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > MAX_VAULT_BODY_BYTES)
    return json({ error: "invalid_request" }, 400);
  const text = await readBoundedBody(request);
  if (text === null) return json({ error: "invalid_request" }, 400);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (
    !isRecord(body) ||
    !hasOnlyKeys(body, ["vaultId", "writeSecret", "envelope", "expectedVersion"])
  ) {
    return json({ error: "invalid_request" }, 400);
  }
  const vaultId = body["vaultId"];
  const writeSecret = body["writeSecret"];
  const envelope = body["envelope"];
  const expectedVersion = body["expectedVersion"];
  if (!validId(vaultId) || !validSecret(writeSecret) || !validEnvelope(envelope)) {
    return json({ error: "invalid_request" }, 400);
  }
  if (
    expectedVersion !== undefined &&
    (typeof expectedVersion !== "number" ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 0)
  ) {
    return json({ error: "invalid_request" }, 400);
  }

  const pathname = await vaultPath(vaultId);
  const existing = await store.get(pathname);
  const secretHash = await sha256Hex(writeSecret);
  if (!existing) {
    if (expectedVersion !== undefined && expectedVersion !== 0) {
      return json({ version: 0, updatedAt: null }, 409);
    }
    const record: VaultRecord = { secretHash, version: 1, envelope };
    try {
      await store.put(pathname, record, null);
    } catch (error) {
      if (error instanceof VaultStoreConflictError) return currentConflict(pathname, store);
      throw error;
    }
    return json({ version: 1, updatedAt: envelope.updatedAt });
  }

  const current = existing.value;
  if (!constantTimeEqual(current.secretHash, secretHash)) return json({ error: "forbidden" }, 403);
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    return json({ version: current.version, updatedAt: current.envelope.updatedAt }, 409);
  }
  const version = current.version + 1;
  try {
    await store.put(pathname, { secretHash: current.secretHash, version, envelope }, existing.etag);
  } catch (error) {
    if (error instanceof VaultStoreConflictError) return currentConflict(pathname, store);
    throw error;
  }
  return json({ version, updatedAt: envelope.updatedAt });
}

async function handleGet(request: Request, store: VaultStore): Promise<Response> {
  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vaultId") ?? "";
  const secret = request.headers.get("x-vault-secret") ?? "";
  if (!validId(vaultId) || !validSecret(secret)) return json({ error: "invalid_request" }, 400);
  const record = await store.get(await vaultPath(vaultId));
  if (!record) return json({ error: "not_found" }, 404);
  if (!constantTimeEqual(record.value.secretHash, await sha256Hex(secret)))
    return json({ error: "forbidden" }, 403);
  if (url.searchParams.get("meta") === "1") {
    return json({ version: record.value.version, updatedAt: record.value.envelope.updatedAt });
  }
  return json({ version: record.value.version, envelope: record.value.envelope });
}

async function currentConflict(pathname: string, store: VaultStore): Promise<Response> {
  const current = await store.get(pathname);
  return json(
    {
      version: current?.value.version ?? 0,
      updatedAt: current?.value.envelope.updatedAt ?? null,
    },
    409,
  );
}

async function handleDelete(request: Request, store: VaultStore): Promise<Response> {
  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vaultId") ?? "";
  const secret = request.headers.get("x-vault-secret") ?? "";
  if (!validId(vaultId) || !validSecret(secret)) return json({ error: "invalid_request" }, 400);
  const pathname = await vaultPath(vaultId);
  const record = await store.get(pathname);
  if (!record) return json({ error: "not_found" }, 404);
  if (!constantTimeEqual(record.value.secretHash, await sha256Hex(secret)))
    return json({ error: "forbidden" }, 403);
  await store.delete(pathname);
  return json({ success: true });
}

function validEnvelope(value: unknown): value is VaultEnvelope {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["v", "kdf", "iv", "ciphertext", "updatedAt"]) ||
    value["v"] !== 1 ||
    !isRecord(value["kdf"])
  )
    return false;
  const kdf = value["kdf"];
  if (
    !hasOnlyKeys(kdf, ["name", "hash", "iterations", "salt"]) ||
    kdf["name"] !== "PBKDF2" ||
    kdf["hash"] !== "SHA-256" ||
    kdf["iterations"] !== 600000
  )
    return false;
  if (
    !hasBytes(kdf["salt"], 16) ||
    !hasBytes(value["iv"], 12) ||
    !hasBytes(value["ciphertext"], 16, MAX_VAULT_BODY_BYTES)
  )
    return false;
  const updatedAt = value["updatedAt"];
  return typeof updatedAt === "string" && Number.isFinite(Date.parse(updatedAt));
}

function hasBytes(value: unknown, min: number, max = min): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const binary = atob(
      value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4),
    );
    return (
      binary.length >= min &&
      binary.length <= max &&
      base64UrlLength(binary.length) === value.length
    );
  } catch {
    return false;
  }
}

function base64UrlLength(bytes: number): number {
  return Math.ceil((bytes * 8) / 6);
}

function validId(value: unknown): value is string {
  return hasBytes(value, 16);
}

function validSecret(value: unknown): value is string {
  return hasBytes(value, 32);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_VAULT_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function vaultPath(vaultId: string): Promise<string> {
  return `vaults/${await sha256Hex(vaultId)}.json`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
