/**
 * Moteur OCR dans le navigateur : ppu-paddle-ocr + onnxruntime-web, mêmes modèles et mêmes
 * réglages que l'évaluation (scripts/ocr/engine-node.ts). Tout est servi par l'appli :
 * modèles dans /ocr/paddle/, moteur ONNX (WebAssembly) empaqueté par Vite. Rien ne part ailleurs :
 * sans chemin explicite, le SDK irait chercher le moteur sur un CDN.
 */
import type { PaddleOcrService } from "ppu-paddle-ocr/web";
// Chemin relatif : le paquet n'exporte pas ses fichiers .wasm.
import ortWasmUrl from "../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import { prepareForOcr } from "@/lib/ocr-preprocess";
import { OCR_CONFIG, OCR_MODELS } from "./config";
import type { OcrPage } from "./layout";
import { cropRect, rereadWeakBoxes } from "./reread";

let servicePromise: Promise<PaddleOcrService> | null = null;

async function getService(): Promise<PaddleOcrService> {
  servicePromise ??= (async () => {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.wasmPaths = { wasm: ortWasmUrl };
    ort.env.wasm.numThreads = 1;
    const { PaddleOcrService } = await import("ppu-paddle-ocr/web");
    const service = new PaddleOcrService({
      model: {
        detection: `/ocr/paddle/${OCR_MODELS.detection}`,
        recognition: `/ocr/paddle/${OCR_MODELS.recognition}`,
        charactersDictionary: `/ocr/paddle/${OCR_MODELS.dictionary}`,
      },
      processing: { engine: OCR_CONFIG.engine },
      detection: OCR_CONFIG.detection,
      recognition: OCR_CONFIG.recognition as never,
      session: { executionProviders: ["wasm"] },
    });
    await service.initialize();
    return service;
  })();
  try {
    return await servicePromise;
  } catch (error) {
    servicePromise = null;
    throw error;
  }
}

async function decode(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Lecture d'image indisponible sur cet appareil.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/** Lit une capture et renvoie ses boîtes de texte (même format que les tests). */
export async function readCaptureWeb(file: Blob): Promise<OcrPage> {
  const service = await getService();
  const canvas = await decode(file);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  if (OCR_CONFIG.preprocess !== "none") {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    prepareForOcr(
      { data: pixels.data, width: canvas.width, height: canvas.height },
      OCR_CONFIG.preprocess,
    );
    context.putImageData(pixels, 0, 0);
  }
  const result = await service.recognize(canvas);
  const page: OcrPage = {
    width: canvas.width,
    height: canvas.height,
    boxes: result.lines.flat().map((item) => ({
      text: item.text,
      x: item.box.x,
      y: item.box.y,
      width: item.box.width,
      height: item.box.height,
      confidence: item.confidence,
    })),
  };
  if (!OCR_CONFIG.reread) return page;
  return rereadWeakBoxes(page, async (box, variant) => {
    const rect = cropRect(box, canvas.width, canvas.height);
    const scale = variant === "half" ? 0.5 : 1;
    const crop = document.createElement("canvas");
    crop.width = Math.max(8, Math.round(rect.width * scale));
    crop.height = Math.max(8, Math.round(rect.height * scale));
    const cropContext = crop.getContext("2d", { willReadFrequently: true })!;
    cropContext.drawImage(
      canvas,
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
      prepareForOcr({ data: pixels.data, width: crop.width, height: crop.height }, "gray");
      cropContext.putImageData(pixels, 0, 0);
    }
    const reread = await service.recognize(crop);
    const items = reread.lines.flat();
    if (!items.length) return null;
    return {
      text: items.map((item) => item.text).join(" "),
      confidence: Math.min(...items.map((item) => item.confidence)),
    };
  });
}
