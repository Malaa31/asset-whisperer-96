import { get, put } from "@vercel/blob";
import { generateObject } from "ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  consumeImportQuota,
  controlsForExtraction,
  type ImportExtraction,
} from "@/lib/import-positions";
import { forbidden, isAllowedOrigin } from "./public/_guard";

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const DAILY_IMPORT_LIMIT = 30;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const requestSchema = z
  .object({
    kind: z.enum(["titres", "solde"]),
    images: z.array(z.string().max(4_000_000)).min(1).max(4),
  })
  .strict();

const nullableText = z.string().trim().max(240).nullable().optional();
const nullableAmount = z.number().finite().nonnegative().nullable();
const positionSchema = z.object({
  nom: z.string().trim().min(1).max(240),
  isin: nullableText,
  ticker: nullableText,
  quantite: nullableAmount,
  pru: nullableAmount.optional(),
  cours: nullableAmount.optional(),
  valeur: nullableAmount.optional(),
  devise: z.string().trim().max(8).nullable().optional(),
  confiance: z.number().min(0).max(1),
});
const titresSchema = z.object({
  courtier: nullableText,
  enveloppe: z.enum(["PEA", "CTO", "inconnu"]).nullable().optional(),
  lignes: z.array(positionSchema).max(150),
  avertissements: z.array(z.string().trim().max(300)).max(30),
});
const soldeSchema = z.object({
  etablissement: nullableText,
  libelle: nullableText,
  solde: nullableAmount,
  date: z.string().trim().max(40).nullable().optional(),
  confiance: z.number().min(0).max(1),
  avertissements: z.array(z.string().trim().max(300)).max(30),
});

interface DecodedImage {
  mediaType: string;
  bytes: Uint8Array;
}

class RequestTooLargeError extends Error {}

const quotaStore = {
  async get(day: string) {
    const pathname = quotaPath(day);
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const record = JSON.parse(text) as { day?: unknown; count?: unknown };
    if (record.day !== day || !Number.isSafeInteger(record.count) || Number(record.count) < 0) {
      throw new Error("invalid_import_quota_record");
    }
    return { count: Number(record.count), etag: result.blob.etag };
  },
  async compareAndSet(day: string, count: number, expectedEtag: string | null) {
    try {
      await put(quotaPath(day), JSON.stringify({ day, count }), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: expectedEtag !== null,
        ...(expectedEtag === null ? {} : { ifMatch: expectedEtag }),
      });
      return true;
    } catch (error) {
      if (await this.get(day)) return false;
      throw error;
    }
  },
};

export const Route = createFileRoute("/api/import-positions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAllowedOrigin(request)) return forbidden();

        const contentLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
          return Response.json({ error: "Capture trop volumineuse." }, { status: 413 });
        }

        let body: unknown;
        try {
          body = await readLimitedJson(request);
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof RequestTooLargeError
                  ? "Capture trop volumineuse."
                  : "Requête invalide.",
            },
            { status: error instanceof RequestTooLargeError ? 413 : 400 },
          );
        }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Requête invalide." }, { status: 400 });
        }

        const images: DecodedImage[] = [];
        let totalBytes = 0;
        for (const dataUrl of parsed.data.images) {
          const image = decodeImageDataUrl(dataUrl);
          if (!image || image.bytes.byteLength > MAX_IMAGE_BYTES) {
            return Response.json(
              { error: "Format ou taille de capture invalide." },
              { status: 400 },
            );
          }
          totalBytes += image.bytes.byteLength;
          if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
            return Response.json({ error: "Capture trop volumineuse." }, { status: 413 });
          }
          images.push(image);
        }

        const utcDay = new Date().toISOString().slice(0, 10);
        try {
          const allowed = await consumeImportQuota(quotaStore, utcDay, DAILY_IMPORT_LIMIT);
          if (!allowed) {
            return Response.json({ error: "Limite d'imports du jour atteinte" }, { status: 429 });
          }
        } catch {
          return Response.json({ error: "Service d'import indisponible." }, { status: 503 });
        }

        const imageParts = images.map((image) => ({
          type: "image" as const,
          image: image.bytes,
          mediaType: image.mediaType,
        }));
        const requestOptions = {
          model: "google/gemini-3-flash",
          temperature: 0,
          reasoning: "minimal" as const,
          maxOutputTokens: 5000,
          providerOptions: {
            gateway: { zeroDataRetention: true },
            google: { thinkingConfig: { thinkingLevel: "minimal" } },
          },
          system:
            "Tu extrais des données financières uniquement à partir des pixels visibles. N'invente jamais une information. Retourne null lorsqu'une valeur est incertaine ou illisible. Les nombres français doivent être convertis en nombres, avec espaces comme séparateurs de milliers et virgule décimale. Ignore les totaux, en-têtes et publicités. Signale dans avertissements toute ligne coupée ou toute capture qui masque une donnée.",
        };

        try {
          if (parsed.data.kind === "titres") {
            const result = await generateObject({
              ...requestOptions,
              schema: titresSchema,
              schemaName: "positions_financieres",
              schemaDescription: "Lignes de titres visibles sur une capture PEA ou CTO.",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyse ces captures d'une page de positions PEA/CTO. Extrais chaque ligne de titre visible, son nom, ISIN, ticker, quantité, PRU, cours, valeur, devise et l'enveloppe si elle est clairement affichée. Ignore les lignes de total et les en-têtes. Si une ligne est tronquée, conserve uniquement les champs lisibles et signale-le.",
                    },
                    ...imageParts,
                  ],
                },
              ],
            });
            const extraction = { kind: "titres", ...result.object } as ImportExtraction;
            return Response.json({
              kind: "titres",
              ...result.object,
              controles: controlsForExtraction(extraction),
            });
          }

          const result = await generateObject({
            ...requestOptions,
            schema: soldeSchema,
            schemaName: "solde_epargne",
            schemaDescription: "Solde visible d'un compte d'épargne ou livret.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyse ces captures d'un compte d'épargne ou d'un livret. Extrais uniquement l'établissement, le libellé du compte, le solde affiché, la date affichée et ta confiance. N'utilise jamais un montant de plafond ou un total de page comme solde.",
                  },
                  ...imageParts,
                ],
              },
            ],
          });
          const extraction = { kind: "solde", ...result.object } as ImportExtraction;
          return Response.json({
            kind: "solde",
            ...result.object,
            controles: controlsForExtraction(extraction),
          });
        } catch {
          return Response.json(
            { error: "Analyse indisponible. Réessaie plus tard." },
            { status: 502 },
          );
        }
      },
    },
  },
});

function quotaPath(day: string): string {
  return `quota/import-${day}.json`;
}

function decodeImageDataUrl(value: string): DecodedImage | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const mediaType = match[1]!;
  if (!ALLOWED_MIME_TYPES.has(mediaType)) return null;
  const encoded = match[2]!;
  if (encoded.length % 4 !== 0) return null;
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.toString("base64") !== encoded) return null;
  return { mediaType, bytes: new Uint8Array(buffer) };
}

async function readLimitedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
