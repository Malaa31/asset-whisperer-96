import { del, get, put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { forbidden, isAllowedOrigin } from "./public/_guard";
import {
  handleVaultRequest,
  VaultStoreConflictError,
  type VaultRecord,
  type VaultStore,
} from "@/lib/vault-server";

const blobStore: VaultStore = {
  get: getVaultRecord,
  async put(pathname, value, expectedEtag) {
    try {
      await put(pathname, JSON.stringify(value), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: expectedEtag !== null,
        ...(expectedEtag === null ? {} : { ifMatch: expectedEtag }),
      });
    } catch (error) {
      if (await getVaultRecord(pathname)) throw new VaultStoreConflictError();
      throw error;
    }
  },
  async delete(pathname) {
    await del(pathname);
  },
};

async function getVaultRecord(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const body = await new Response(result.stream).text();
  if (new TextEncoder().encode(body).byteLength > 2 * 1024 * 1024) return null;
  try {
    return { value: JSON.parse(body) as VaultRecord, etag: result.blob.etag };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/vault")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();
        return handleVaultRequest(request, blobStore);
      },
      PUT: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();
        return handleVaultRequest(request, blobStore);
      },
      DELETE: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();
        return handleVaultRequest(request, blobStore);
      },
    },
  },
});
