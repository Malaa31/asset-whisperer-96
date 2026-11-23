import { normalizeLabel, parseLoanCapture } from "@/lib/loan-import";
import { parsePositionText } from "@/lib/position-parser";

export type CaptureKind = "titres" | "solde" | "credit";

const SIGNALS: Record<CaptureKind, RegExp[]> = {
  titres: [
    /\bpru\b/, /\bquantite\b/, /\bqte\b/, /\bcours\b/, /\bvalorisation\b/, /\bpx revient\b/, /\bprix de revient\b/,
    /\bplus values?\b/, /\blatentes?\b/, /\bucits\b/, /\betf\b/, /\bpea\b/, /\bcto\b/, /\bcompte titres?\b/,
    /\bportefeuille\b/, /\bactions\b/, /\bparts\b/,
  ],
  solde: [/\blivret ?a?\b/, /\bldds\b/, /\blep\b/, /\bplafond\b/, /\binterets acquis\b/, /\bepargne\b/, /\bsolde\b/, /\bremuneration\b/],
  credit: [
    /\bpret\b/, /\bcredit\b/, /\bcapital restant\b/, /\bmensualite\b/, /\becheances?\b/, /\bamortissements?\b/,
    /\bduree\b/, /\bemprunte\b/, /\btaeg\b/, /\bptz\b/, /\bremboursements?\b/, /\btaux\b/,
  ],
};
const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}\d\b/;

/** Devine le type d'une capture d'après son vocabulaire. `null` si rien de net. */
export function detectCaptureKind(text: string): CaptureKind | null {
  const normalized = ` ${normalizeLabel(text)} `;
  // Mots collés par l'OCR (« Plafondréglementaire », « Soldeau ») : on teste aussi sans espaces.
  const compact = normalized.replace(/ /g, "");
  const hit = (pattern: RegExp) =>
    pattern.test(normalized) || new RegExp(pattern.source.replace(/\\b/g, "").replace(/ \??/g, ""), pattern.flags).test(compact);
  const scores = (Object.keys(SIGNALS) as CaptureKind[]).map((kind) => ({
    kind,
    score: SIGNALS[kind].filter(hit).length + (kind === "titres" && ISIN_RE.test(text) ? 2 : 0),
  }));
  scores.sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  if (!first || first.score < 2 || first.score - (second?.score ?? 0) < 2) return null;
  return first.kind;
}

/** Type majoritaire d'un lot de captures, et nombre de captures d'un autre type. */
export function dominantKind(texts: string[]): { kind: CaptureKind | null; others: number } {
  const detected = texts.map(detectCaptureKind);
  const counts = new Map<CaptureKind, number>();
  for (const kind of detected) if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return { kind: null, others: 0 };
  return { kind: best[0], others: detected.filter((kind) => kind && kind !== best[0]).length };
}

/**
 * Note de cohérence d'une lecture, pour choisir entre deux passages de l'OCR :
 * lignes de positions cohérentes, solde trouvé, ou nombre de champs de crédit reconnus.
 */
export function captureQuality(text: string): number {
  const kind = detectCaptureKind(text);
  if (kind === "credit") return Object.keys(parseLoanCapture(text).fields).length;
  if (kind === "solde") {
    const result = parsePositionText(text, "solde");
    return result.kind === "solde" && result.solde !== null ? 10 * result.confiance : 0;
  }
  const result = parsePositionText(text, "titres");
  if (result.kind !== "titres") return 0;
  const skipped = result.avertissements.filter((warning) => warning.includes("non importée")).length;
  return result.lignes.reduce((sum, line) => sum + 10 * line.confiance, 0) - 5 * skipped;
}

/** Le premier passage mérite-t-il un second essai ? */
export function needsSecondPass(text: string): boolean {
  const kind = detectCaptureKind(text);
  if (kind === "credit") return Object.keys(parseLoanCapture(text).fields).length < 3;
  if (kind === "solde") {
    const result = parsePositionText(text, "solde");
    return result.kind !== "solde" || result.solde === null;
  }
  const result = parsePositionText(text, "titres");
  return (
    result.kind !== "titres" ||
    result.lignes.length === 0 ||
    result.avertissements.some((warning) => warning.includes("non importée")) ||
    result.lignes.some((line) => line.confiance < 0.6)
  );
}

/** Séparateur entre captures dans le texte envoyé par le raccourci iPhone. */
export const CAPTURE_MARKER = "=== capture ===";

/** Découpe un texte collé ou reçu du raccourci en une entrée par capture. */
export function splitCaptureText(text: string): string[] {
  const parts = text
    .split(/^[ \t]*={2,}[ \t]*capture[ \t]*={2,}[ \t]*$/im)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}
