import { INSTRUMENTS, type Instrument } from "./instruments";

/**
 * Recherche approximative d'un titre à partir du nom lu par l'OCR, même abîmé :
 * « AMuNDIPeAeMerGent(MSCl » → AMUNDI PEA EMERGENT (MSCI EMERGING)… → FR0013412020.
 *
 * Les deux côtés sont ramenés à une forme canonique (majuscules, sans accents ni espaces,
 * confusions OCR fréquentes fusionnées : O/0, I/l/1, S/5, B/8), puis comparés par distance
 * d'édition, en entier ou en préfixe (nom tronqué, ou première ligne d'un nom sur plusieurs lignes).
 */

export function canonical(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

function similarity(ocr: string, candidate: string): number {
  if (!ocr || !candidate) return 0;
  const full = 1 - levenshtein(ocr, candidate) / Math.max(ocr.length, candidate.length);
  let prefix = 0;
  if (ocr.length >= 6 && candidate.length > ocr.length) {
    prefix =
      (1 - levenshtein(ocr, candidate.slice(0, ocr.length)) / ocr.length) *
      (ocr.length >= 12 ? 0.98 : 0.9);
  }
  // Le nom lu contient le nom du titre plus du bruit (icône, chevron lus comme des lettres).
  let contains = 0;
  if (candidate.length >= 5 && ocr.includes(candidate))
    contains = 0.9 + 0.08 * (candidate.length / ocr.length);
  return Math.max(full, prefix, contains);
}

export interface NameMatch {
  instrument: Instrument;
  score: number;
}

const CANONICAL_VARIANTS = INSTRUMENTS.map((instrument) => ({
  instrument,
  variants: [instrument.name, instrument.short, ...(instrument.aliases ?? [])].map(canonical),
}));

const EXCHANGES = new Set([
  "EPA",
  "EAM",
  "XET",
  "XETRA",
  "NDQ",
  "NSY",
  "NYSE",
  "MIL",
  "LSE",
  "XPAR",
  "PAR",
  "AMS",
  "ETR",
  "TDG",
  "GER",
  "SWX",
  "BIT",
  "MTA",
]);

/**
 * Variantes du nom lu, pour ignorer ce qui suit souvent le nom sur la même carte :
 * code de place (« EPA », « NDQ »), ticker (« CS », « VWRL ») et séparateurs (« · »).
 */
function candidates(name: string): string[] {
  const words = name
    .replace(/[·•|・]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const last = (words.at(-1) ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
  // Seulement « … TICKER PLACE » : un code de place connu en dernier, éventuellement précédé du ticker.
  if (words.length < 3 || !EXCHANGES.has(last)) return [name];
  const withoutExchange = words.slice(0, -1);
  const ticker = withoutExchange.at(-1) ?? "";
  const variants = [name, withoutExchange.join(" ")];
  if (/^[A-Za-z0-9.]{1,6}$/.test(ticker) && withoutExchange.length > 1)
    variants.push(withoutExchange.slice(0, -1).join(" "));
  return variants;
}

/** Le titre le plus proche, ou null si rien n'est assez proche ou si deux titres se valent. */
export function resolveInstrument(
  name: string,
  options: { minScore?: number; margin?: number } = {},
): NameMatch | null {
  const minScore = options.minScore ?? 0.78;
  const margin = options.margin ?? 0.04;
  const ocrVariants = candidates(name)
    .map(canonical)
    .filter((value) => value.length >= 3);
  if (!ocrVariants.length) return null;
  const scored = CANONICAL_VARIANTS.map(({ instrument, variants }) => ({
    instrument,
    score: Math.max(
      ...ocrVariants.flatMap((ocr) => variants.map((variant) => similarity(ocr, variant))),
    ),
  })).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < minScore) return null;
  if (second && best.score - second.score < margin) return null;
  return best;
}
