import type { ImportExtraction, PositionLine } from "./import-positions";

const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}\d\b/g;
const NUMBER_RE = /(?<![A-Za-z0-9])[+−–-]?\s*(?:[0-9OIlS]{1,3}(?:[\u00a0\u202f ][0-9OIlS]{3})+(?:[.,][0-9OIlS]+)?|[0-9OIlS]+(?:[.,][0-9OIlS]+)?)(?:\s*(?:€|%|EUR))?(?![A-Za-z])/g;
const HEADER_RE = /(?:qt[eé]|quantit[eé]|nb|nombre|pru|prix de revient|pam|cours|dernier|valorisation|montant|valeur|variation|plus.?value)/i;
const SUMMARY_RE = /\b(?:total|solde esp[eè]ces|liquidit[eé]s?|plus.?value latente totale|valorisation totale|plafond)\b/i;

type Column = "quantite" | "pru" | "cours" | "valeur" | "variation";

export function parsePositionText(text: string, kind: "titres" | "solde"): ImportExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (kind === "solde") return parseSavings(lines);
  const allText = lines.join(" ");
  const enveloppe = /\bPEA\b/i.test(allText)
    ? "PEA"
    : /\b(?:CTO|compte[ -]titres)\b/i.test(allText)
      ? "CTO"
      : "inconnu";
  const header = lines.find((line) => HEADER_RE.test(line));
  const columns = header ? headerColumns(header) : [];
  const positions: PositionLine[] = [];
  let pendingName = "";
  let pendingNumbers: number[] = [];
  let pendingIsin: string | null = null;

  const flush = () => {
    if (!pendingName || pendingNumbers.length < 2) return;
    const mapped = columns.length
      ? mapByHeaders(pendingNumbers, columns)
      : inferByConsistency(pendingNumbers);
    if (mapped.quantite == null) mapped.quantite = pendingNumbers[0] ?? null;
    const confidence = Math.min(
      0.99,
      0.4 + (pendingIsin ? 0.32 : 0) + (columns.length ? 0.18 : 0) + (mapped.valeur != null ? 0.08 : 0),
    );
    positions.push({ nom: pendingName, isin: pendingIsin, ticker: null, quantite: mapped.quantite ?? null, pru: mapped.pru ?? null, cours: mapped.cours ?? null, valeur: mapped.valeur ?? null, devise: "EUR", confiance: confidence });
    pendingName = "";
    pendingNumbers = [];
    pendingIsin = null;
  };

  for (const line of lines) {
    if (SUMMARY_RE.test(line) || line === header || /^(?:PEA|CTO|compte[ -]titres)$/i.test(line)) continue;
    const isin = [...line.matchAll(ISIN_RE)].map((match) => match[0]).find(isValidIsin) ?? null;
    const values = numbers(line.replace(ISIN_RE, ""));
    const name = cleanText(line.replace(ISIN_RE, "").replace(NUMBER_RE, " "));
    if (name && values.length === 0) {
      flush();
      pendingName = name;
      pendingIsin = isin;
      continue;
    }
    if (isin) {
      flush();
      pendingName = name || pendingName;
      pendingIsin = isin;
    } else if (name && values.length >= 2) {
      flush();
      pendingName = name;
    }
    if (values.length) {
      const distinctSequence = values.filter((value, index) => index === 0 || value !== values[index - 1]);
      pendingNumbers.push(...distinctSequence);
    }
    if (columns.length && pendingNumbers.length >= columns.length) flush();
  }
  flush();
  return {
    kind: "titres",
    enveloppe,
    lignes: positions,
    avertissements: positions.length ? [] : ["Aucune ligne de position reconnue. Vérifie le texte ou utilise la sélection de texte de ton téléphone."],
  };
}

function numbers(text: string): number[] {
  return [...text.matchAll(NUMBER_RE)]
    .map((match) => normalizeNumber(match[0]))
    .filter((value): value is number => value !== null);
}

function normalizeNumber(raw: string): number | null {
  let value = raw.replace(/O/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5").replace(/[\s\u00a0\u202f']/g, "").replace(/[€%]|EUR/gi, "").replace(/[−–]/g, "-");
  if (!/^[+-]?[\d.,]+$/.test(value)) return null;
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if ((value.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(value)) value = value.replace(/\./g, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string): string {
  return value.replace(/[|•·]/g, " ").replace(/\s+/g, " ").replace(/^[\s:–-]+|[\s:–-]+$/g, "").trim();
}

function headerColumns(header: string): Column[] {
  const specs: Array<[Column, RegExp]> = [
    ["quantite", /(?:qt[eé]|quantit[eé]|nb|nombre)/i],
    ["pru", /\b(?:pru|prix de revient|pam)\b/i],
    ["cours", /\b(?:cours|dernier|prix)\b/i],
    ["valeur", /\b(?:valorisation|montant|valeur)\b/i],
    ["variation", /(?:\+\s*\/?\s*-|plus.?value|variation)/i],
  ];
  return specs.flatMap(([column, pattern]) => {
    const match = pattern.exec(header);
    return match ? [{ column, index: match.index }] : [];
  }).sort((a, b) => a.index - b.index).map(({ column }) => column);
}

function mapByHeaders(values: number[], columns: Column[]): Partial<Record<"quantite" | "pru" | "cours" | "valeur", number | null>> {
  const mapped: Partial<Record<"quantite" | "pru" | "cours" | "valeur", number | null>> = {};
  columns.forEach((column, index) => {
    if (column !== "variation" && values[index] !== undefined) mapped[column] = values[index];
  });
  return mapped;
}

function inferByConsistency(values: number[]): Partial<Record<"quantite" | "pru" | "cours" | "valeur", number | null>> {
  for (let q = 0; q < values.length; q++) {
    for (let p = 0; p < values.length; p++) {
      if (p === q) continue;
      for (let v = 0; v < values.length; v++) {
        if (v === q || v === p) continue;
        if (Math.abs(values[q]! * values[p]! - values[v]!) / Math.max(Math.abs(values[v]!), 0.01) <= 0.02) {
          return { quantite: values[q] ?? null, cours: values[p] ?? null, valeur: values[v] ?? null, pru: values.find((_, i) => i !== q && i !== p && i !== v) ?? null };
        }
      }
    }
  }
  return { quantite: values[0] ?? null, pru: values[1] ?? null, cours: values[2] ?? null, valeur: values[3] ?? null };
}

function isValidIsin(isin: string): boolean {
  const expanded = [...isin].map((char) => /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char).join("");
  let sum = 0;
  let double = false;
  for (let index = expanded.length - 1; index >= 0; index--) {
    let digit = Number(expanded[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function parseSavings(lines: string[]): Extract<ImportExtraction, { kind: "solde" }> {
  const label = lines.find((line) => /livret\s*a/i.test(line)) ?? "Livret A";
  const candidates: Array<{ value: number; confidence: number }> = [];
  lines.forEach((line, index) => {
    if (/plafond|taux|int[eé]r[eê]t/i.test(line)) return;
    if (/\b(?:solde|montant disponible)\b/i.test(line)) {
      const amount = numbers(line.replace(/.*?\b(?:solde|montant disponible)\b/i, ""))[0] ?? numbers(lines[index + 1] ?? "")[0];
      if (amount !== undefined) candidates.push({ value: amount, confidence: 0.96 });
    }
  });
  if (!candidates.length) {
    const index = lines.findIndex((line) => /livret\s*a/i.test(line));
    const amount = index >= 0 ? numbers(lines[index + 1] ?? "")[0] : undefined;
    if (amount !== undefined) candidates.push({ value: amount, confidence: 0.78 });
  }
  const chosen = candidates[0];
  return { kind: "solde", libelle: cleanText(label) || "Livret A", solde: chosen?.value ?? null, confiance: chosen?.confidence ?? 0, avertissements: chosen ? [] : ["Solde introuvable : vérifie le texte collé."] };
}
