/**
 * Réglages de l'OCR, partagés par l'appli et l'évaluation : même moteur, mêmes modèles,
 * mêmes paramètres partout. Tout changement ici invalide le cache de l'évaluation.
 */
export const OCR_MODELS = {
  detection: "PP-OCRv5_mobile_det_infer.ort",
  recognition: "PP-OCRv5_mobile_rec_infer.onnx",
  dictionary: "ppocrv5_dict.txt",
} as const;

export const OCR_CONFIG = {
  version: 2,
  /** "opencv" (OpenCV.js) ou "canvas-native" (sans OpenCV, plus léger dans le navigateur). */
  engine: "canvas-native" as "opencv" | "canvas-native",
  /** Prétraitement maison avant l'OCR (voir ocr-preprocess.ts). */
  preprocess: "none" as "none" | "gray" | "standard" | "binarized",
  detection: {
    maxSideLength: "auto" as number | "auto",
    minimumAreaThreshold: 20,
    paddingVertical: 0.4,
    paddingHorizontal: 0.6,
  },
  /** Seuil bas : les lignes douteuses sont gardées pour être relues (voir reread.ts), puis filtrées à 0,5. */
  recognition: {
    strategy: "per-line" as "per-box" | "per-line" | "cross-line",
    minimumConfidence: 0.2,
    spaceRecovery: false,
  },
  reread: true,
};

export type OcrConfig = typeof OCR_CONFIG;
