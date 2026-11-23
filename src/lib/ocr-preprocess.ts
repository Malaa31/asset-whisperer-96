/**
 * Préparation d'une capture avant la reconnaissance de texte (Tesseract), sur l'appareil.
 *
 * - On lit l'image d'origine, sans recompression JPEG (les artefacts mangent les virgules).
 * - Résolution native (seules les petites images sont agrandies).
 * - Niveaux de gris, étirement du contraste par centiles (fonds colorés, texte gris clair).
 * - Mode sombre (texte clair sur fond sombre) : image inversée, sinon Tesseract lit mal.
 * - Variante binarisée (seuil d'Otsu), utilisée en second passage si le premier déçoit.
 */

export interface PixelImage {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

export type OcrVariant = "standard" | "binarized" | "gray";

const MAX_PIXELS = 8_000_000;

/**
 * Facteur d'échelle. Mesuré sur de vraies captures : la résolution native d'une capture
 * d'iPhone suffit (agrandir ne gagne rien et ralentit) ; seules les petites images sont
 * agrandies, et les très grandes réduites pour borner la mémoire.
 */
export function ocrScale(width: number, height: number): number {
  if (!width || !height) return 1;
  const upscale = width < 1000 ? Math.min(2, 1600 / width) : 1;
  const byPixels = Math.sqrt(MAX_PIXELS / (width * height));
  return Math.max(0.25, Math.min(upscale, byPixels));
}

/** Prépare les pixels en place (RGBA → niveaux de gris). Renvoie si l'image a été inversée. */
export function prepareForOcr(image: PixelImage, variant: OcrVariant = "standard"): { inverted: boolean } {
  const { data, width, height } = image;
  const count = width * height;
  if (variant === "gray") {
    // Niveaux de gris seuls : mesuré meilleur pour PaddleOCR (les grands chiffres gras restent lisibles).
    for (let p = 0; p < count * 4; p += 4) {
      const value = Math.round(0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!);
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
    }
    return { inverted: false };
  }
  const gray = new Uint8Array(count);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    const value = Math.round(0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!);
    gray[i] = value;
    histogram[value]!++;
  }

  // Fond majoritairement sombre : texte clair → on inverse.
  const median = percentile(histogram, count, 0.5);
  const inverted = median < 100;
  if (inverted) {
    histogram.fill(0);
    for (let i = 0; i < count; i++) {
      gray[i] = 255 - gray[i]!;
      histogram[gray[i]!]!++;
    }
  }

  // Étirement du contraste : 1er et 99e centiles ramenés à 0 et 255.
  const low = percentile(histogram, count, 0.01);
  const high = Math.max(low + 1, percentile(histogram, count, 0.99));
  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value++) {
    lut[value] = Math.max(0, Math.min(255, Math.round(((value - low) * 255) / (high - low))));
  }

  let threshold = -1;
  if (variant === "binarized") {
    const stretched = new Uint32Array(256);
    for (let value = 0; value < 256; value++) stretched[lut[value]!]! += histogram[value]!;
    threshold = otsu(stretched, count);
  }

  for (let i = 0, p = 0; i < count; i++, p += 4) {
    let value = lut[gray[i]!]!;
    if (threshold >= 0) value = value > threshold ? 255 : 0;
    data[p] = value;
    data[p + 1] = value;
    data[p + 2] = value;
    data[p + 3] = 255;
  }
  return { inverted };
}

function percentile(histogram: Uint32Array, count: number, ratio: number): number {
  const target = count * ratio;
  let seen = 0;
  for (let value = 0; value < 256; value++) {
    seen += histogram[value]!;
    if (seen >= target) return value;
  }
  return 255;
}

function otsu(histogram: Uint32Array, count: number): number {
  let sum = 0;
  for (let value = 0; value < 256; value++) sum += value * histogram[value]!;
  let backgroundSum = 0;
  let backgroundWeight = 0;
  let best = 0;
  let threshold = 127;
  for (let value = 0; value < 256; value++) {
    backgroundWeight += histogram[value]!;
    if (!backgroundWeight) continue;
    const foregroundWeight = count - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += value * histogram[value]!;
    const meanBackground = backgroundSum / backgroundWeight;
    const meanForeground = (sum - backgroundSum) / foregroundWeight;
    const between = backgroundWeight * foregroundWeight * (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = value;
    }
  }
  return threshold;
}
