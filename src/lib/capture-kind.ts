import { normalizeLabel } from "@/lib/loan-import";

export type CaptureKind = "titres" | "solde" | "credit";

const SIGNALS: Record<CaptureKind, RegExp[]> = {
  titres: [
    /\bpru\b/, /\bquantite\b/, /\bqte\b/, /\bcours\b/, /\bvalorisation\b/, /\bpx revient\b/, /\bprix de revient\b/,
    /\bplus values?\b/, /\blatentes?\b/, /\bucits\b/, /\betf\b/, /\bpea\b/, /\bcto\b/, /\bcompte titres?\b/,
    /\bportefeuille\b/, /\bactions\b/, /\bparts\b/,
  ],
  solde: [/\blivret\b/, /\bldds\b/, /\blep\b/, /\bplafond\b/, /\binterets acquis\b/, /\bepargne\b/, /\bsolde\b/],
  credit: [
    /\bpret\b/, /\bcredit\b/, /\bcapital restant\b/, /\bmensualite\b/, /\becheances?\b/, /\bamortissements?\b/,
    /\bduree\b/, /\bemprunte\b/, /\btaeg\b/, /\bptz\b/, /\bremboursements?\b/, /\btaux\b/,
  ],
};
const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}\d\b/;

/** Devine le type d'une capture d'après son vocabulaire. `null` si rien de net. */
export function detectCaptureKind(text: string): CaptureKind | null {
  const normalized = ` ${normalizeLabel(text)} `;
  const scores = (Object.keys(SIGNALS) as CaptureKind[]).map((kind) => ({
    kind,
    score: SIGNALS[kind].filter((pattern) => pattern.test(normalized)).length + (kind === "titres" && ISIN_RE.test(text) ? 2 : 0),
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
