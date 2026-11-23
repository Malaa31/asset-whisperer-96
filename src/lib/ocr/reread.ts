import type { OcrBox, OcrPage } from "./layout";

/**
 * Relecture ciblée : les boîtes lues avec une confiance faible (souvent les grands chiffres
 * gras d'un solde ou d'un total) sont relues seules, sur leur découpe, en niveaux de gris puis
 * à demi-taille ; la lecture la plus sûre l'emporte. Les boîtes encore trop douteuses sont écartées.
 * Commun à l'appli et aux tests : seul le lecteur de découpe dépend de la plateforme.
 */

export type RereadVariant = "gray" | "half";
export type CropReader = (
  box: OcrBox,
  variant: RereadVariant,
) => Promise<{ text: string; confidence: number } | null>;

export const REREAD = { below: 0.75, keep: 0.5, variants: ["gray", "half"] as RereadVariant[] };

export async function rereadWeakBoxes(page: OcrPage, read: CropReader): Promise<OcrPage> {
  const boxes: OcrBox[] = [];
  for (const box of page.boxes) {
    let best = box;
    if (box.confidence < REREAD.below) {
      for (const variant of REREAD.variants) {
        const result = await read(box, variant);
        if (result && result.text.trim() && result.confidence > best.confidence)
          best = { ...box, text: result.text, confidence: result.confidence };
      }
    }
    if (best.confidence >= REREAD.keep) boxes.push(best);
  }
  return { ...page, boxes };
}

/** Découpe autour d'une boîte, avec une marge proportionnelle à sa hauteur. */
export function cropRect(box: OcrBox, width: number, height: number) {
  const pad = Math.round(box.height * 0.35);
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  return {
    x,
    y,
    width: Math.min(width - x, Math.ceil(box.width + 2 * pad)),
    height: Math.min(height - y, Math.ceil(box.height + 2 * pad)),
  };
}
