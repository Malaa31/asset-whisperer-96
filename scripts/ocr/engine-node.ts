/**
 * Moteur OCR côté Node (évaluation, tests) : ppu-paddle-ocr + onnxruntime-node, avec les mêmes
 * modèles (public/ocr/paddle) et les mêmes réglages (src/lib/ocr/config.ts) que l'appli.
 * Résultats mis en cache par empreinte (image + réglages) dans .cache/ocr/.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PaddleOcrService } from "ppu-paddle-ocr";
import { OCR_CONFIG, OCR_MODELS, type OcrConfig } from "../../src/lib/ocr/config";
import type { OcrPage } from "../../src/lib/ocr/layout";
import { prepareForOcr } from "../../src/lib/ocr-preprocess";
import { cropRect, REREAD, rereadWeakBoxes } from "../../src/lib/ocr/reread";

const MODEL_DIR = join(process.cwd(), "public", "ocr", "paddle");
const CACHE_DIR = join(process.cwd(), ".cache", "ocr");

export interface OcrRead extends OcrPage {
  cached: boolean;
  ms: number;
}

export async function createNodeEngine(config: OcrConfig = OCR_CONFIG) {
  let service: PaddleOcrService | null = null;
  const configKey = JSON.stringify({
    config,
    models: OCR_MODELS,
    reread: config.reread ? REREAD : null,
  });
  mkdirSync(CACHE_DIR, { recursive: true });

  const ensure = async () => {
    if (service) return service;
    service = new PaddleOcrService({
      model: {
        detection: join(MODEL_DIR, OCR_MODELS.detection),
        recognition: join(MODEL_DIR, OCR_MODELS.recognition),
        charactersDictionary: join(MODEL_DIR, OCR_MODELS.dictionary),
      },
      processing: { engine: config.engine },
      detection: config.detection,
      recognition: config.recognition as never,
    });
    await service.initialize();
    return service;
  };

  return {
    configKey,
    async read(imagePath: string): Promise<OcrRead> {
      const bytes = readFileSync(imagePath);
      const key = createHash("sha256").update(bytes).update(configKey).digest("hex").slice(0, 32);
      const cachePath = join(CACHE_DIR, `${key}.json`);
      if (existsSync(cachePath))
        return { ...(JSON.parse(readFileSync(cachePath, "utf8")) as OcrPage), cached: true, ms: 0 };
      const engine = await ensure();
      const started = Date.now();
      const image = await loadImage(bytes);
      const canvas = createCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      if (config.preprocess !== "none") {
        const pixels = context.getImageData(0, 0, image.width, image.height);
        prepareForOcr(
          {
            data: pixels.data as unknown as Uint8ClampedArray,
            width: image.width,
            height: image.height,
          },
          config.preprocess,
        );
        context.putImageData(pixels, 0, 0);
      }
      const result = await engine.recognize(canvas as never);
      const page: OcrPage = {
        width: image.width,
        height: image.height,
        boxes: result.lines.flat().map((item) => ({
          text: item.text,
          x: item.box.x,
          y: item.box.y,
          width: item.box.width,
          height: item.box.height,
          confidence: item.confidence,
        })),
      };
      const final = config.reread
        ? await rereadWeakBoxes(page, async (box, variant) => {
            const rect = cropRect(box, image.width, image.height);
            const scale = variant === "half" ? 0.5 : 1;
            const crop = createCanvas(
              Math.max(8, Math.round(rect.width * scale)),
              Math.max(8, Math.round(rect.height * scale)),
            );
            const cropContext = crop.getContext("2d");
            cropContext.drawImage(
              image,
              rect.x,
              rect.y,
              rect.width,
              rect.height,
              0,
              0,
              crop.width,
              crop.height,
            );
            if (variant === "gray") {
              const pixels = cropContext.getImageData(0, 0, crop.width, crop.height);
              prepareForOcr(
                {
                  data: pixels.data as unknown as Uint8ClampedArray,
                  width: crop.width,
                  height: crop.height,
                },
                "gray",
              );
              cropContext.putImageData(pixels, 0, 0);
            }
            const reread = await engine.recognize(crop as never);
            const items = reread.lines.flat();
            if (!items.length) return null;
            return {
              text: items.map((item) => item.text).join(" "),
              confidence: Math.min(...items.map((item) => item.confidence)),
            };
          })
        : page;
      writeFileSync(cachePath, JSON.stringify(final));
      return { ...final, cached: false, ms: Date.now() - started };
    },
    async destroy() {
      await service?.destroy();
    },
  };
}
