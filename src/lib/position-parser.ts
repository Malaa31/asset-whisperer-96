import type { ImportExtraction, PositionLine } from "./import-positions";

const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}\d\b/g;
const HEADER_PATTERNS = {
  quantity: /\b(?:qt[eé]|quantit[eé]|nb|nombre)\b/i,
  pru: /\b(?:pru|prix de revient|pam)\b/i,
  price: /\b(?:cours|dernier|prix)\b/i,
  value: /\b(?:valorisation|montant|valeur)\b/i,
  variation: /(?:\+\s*\/?\s*-|plus.?value|variation)/i,
};

export function parsePositionText(text: string, kind: "titres" | "solde"): ImportExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (kind === "solde") return parseSavings(lines);
  const joined = lines.join(" ");
  const enveloppe = /\bPEA\b/i.test(joined) ? "PEA" : /\b(?:CTO|compte[ -]titres)\b/i.test(joined) ? "CTO" : "inconnu";
  const headerLine = lines.find((line) => Object.values(HEADER_PATTERNS).some((pattern) => pattern.test(line)));
  const columns = headerLine ? headerOrder(headerLine) : [];
  const rows: PositionLine[] = [];
  let mobileName = "";
  for (const line of lines) {
    if (isSummary(line) || (headerLine && line === headerLine)) continue;
    const isin = [...line.matchAll(ISIN_RE)].map((match) => match[0]).find(validIsin);
    const numeric = extractNumbers(line.replace(ISIN_RE, ""));
    if (!isin && numeric.length < 2) {
      if (!extractNumbers(line).length && !isSummary(line)) mobileName = cleanName(line);
      continue;
    }
    const name = cleanName(line.replace(ISIN_RE, "").replace(NUMBER_TOKEN_RE, " ")) || mobileName;
    if (!name) continue;
    const mapped = mapNumbers(numeric, columns);
    const confidence = Math.max(0.35, Math.min(0.99, (isin ? 0.36 : 0.18) + (columns.length ? 0.28 : 0.1) + (mapped.valeur != null ? 0.2 : 0) + (numeric.length >= 3 ? 0.15 : 0)));
    rows.push({ nom: name, isin: isin ?? null, ticker: null, quantite: mapped.quantite ?? numeric[0] ?? null, pru: mapped.pru, cours: mapped.cours, valeur: mapped.valeur, devise: "EUR", confiance: confidence });
    mobileName = "";
  }
  return { kind: "titres", enveloppe, lignes: rows, avertissements: rows.length ? [] : ["Aucune ligne de position reconnue. Vérifie le texte ou utilise la sélection de texte de ton téléphone."] };
}

const NUMBER_TOKEN_RE = /[−–-]?\s*[0-9OIlS][0-9OIlS\s\u00a0\u202f'.,]*\s*(?:€|%|EUR)?/g;
function normalizeNumericToken(token: string): number | null {
  const fixed = token.replace(/[O]/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5");
  const clean = fixed.replace(/\s/g, "").replace(/[€%]|EUR/gi, "").replace(/−|–/g, "-");
  if (!/^-?[\d.,]+$/.test(clean)) return null;
  let value = clean;
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if ((value.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(value)) value = value.replace(/\./g, "");
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function extractNumbers(line: string): number[] { return [...line.matchAll(NUMBER_TOKEN_RE)].map((item) => normalizeNumericToken(item[0])).filter((value): value is number => value !== null); }
function cleanName(line: string): string { return line.replace(ISIN_RE, "").replace(NUMBER_TOKEN_RE, " ").replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim(); }
function isSummary(line: string): boolean { return /\b(?:total|solde esp[eè]ces|liquidit[eé]s?|plus.?value latente totale|valorisation totale|plafond)\b/i.test(line); }
function headerOrder(header: string): string[] {
  const entries = Object.entries(HEADER_PATTERNS).flatMap(([key, pattern]) => { const match = pattern.exec(header); return match ? [{ key, index: match.index }] : []; });
  return entries.sort((a, b) => a.index - b.index).map((item) => item.key);
}
function mapNumbers(numbers: number[], columns: string[]): Partial<Record<"quantite" | "pru" | "cours" | "valeur", number>> {
  const result: Partial<Record<"quantite" | "pru" | "cours" | "valeur", number>> = {};
  if (columns.length && numbers.length >= 2) columns.forEach((column, index) => { if (column !== "variation" && numbers[index] !== undefined) result[column as keyof typeof result] = numbers[index]; });
  if (result.quantite == null && numbers.length >= 3) {
    const candidates = numbers.slice(0, 4);
    for (let q = 0; q < candidates.length - 1; q++) for (let p = q + 1; p < candidates.length; p++) {
      const value = candidates.find((candidate, i) => i !== q && i !== p && Math.abs(candidates[q]! * candidates[p]! - candidate) / Math.max(Math.abs(candidate), 0.01) <= 0.02);
      if (value !== undefined) return { quantite: candidates[q], cours: candidates[p], valeur: value };
    }
    return { quantite: numbers[0], pru: numbers[1], cours: numbers[2], valeur: numbers[3] };
  }
  return result;
}
function validIsin(isin: string): boolean {
  const expanded = [...isin].map((char) => /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char).join("");
  let sum = 0, double = false;
  for (let i = expanded.length - 1; i >= 0; i--) { let digit = Number(expanded[i]); if (double) { digit *= 2; if (digit > 9) digit -= 9; } sum += digit; double = !double; }
  return sum % 10 === 0;
}
function parseSavings(lines: string[]): Extract<ImportExtraction, { kind: "solde" }> {
  const relevant = lines.filter((line) => /\b(?:solde|montant disponible|livret\s*a)\b/i.test(line) && !/plafond|taux|int[eé]r[eê]t/i.test(line));
  const amount = relevant.map((line) => extractNumbers(line)).find((values) => values.length)?.[0] ?? null;
  const label = lines.find((line) => /livret\s*a/i.test(line)) ?? "Livret";
  return { kind: "solde", libelle: cleanName(label) || "Livret A", solde: amount, confiance: amount === null ? 0 : relevant[0]?.includes(String(amount)) ? 0.95 : 0.72, avertissements: amount === null ? ["Solde introuvable : vérifie le texte collé."] : [] };
}
