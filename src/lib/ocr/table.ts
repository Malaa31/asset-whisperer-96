import type { PositionLine } from "@/lib/import-positions";
import { isValidIsin } from "@/lib/position-parser";
import type { OcrBox, Row } from "./layout";

/**
 * Lecture d'un tableau par colonnes (Bourse Direct, sites web) : la ligne d'en-têtes donne la
 * position horizontale de chaque colonne, et chaque nombre est rangé dans la colonne sous laquelle
 * il se trouve. Une boîte OCR qui fusionne deux cellules (« 1 3305,720 ») est découpée en mots,
 * dont la position est estimée d'après leur rang dans la boîte. Les lignes sans nombre qui suivent
 * une ligne de valeurs (suite d'un nom tronqué, ISIN) lui appartiennent.
 */

type Field = "nom" | "quantite" | "pru" | "cours" | "valeur" | "variation";

const HEADER_WORDS: Array<[Field, RegExp]> = [
  ["nom", /^(?:valeur|libell[ée]|titre|nom|instrument)s?$/i],
  ["quantite", /^(?:qt[ée]s?\.?|quantit[ée]s?|nb)$/i],
  ["pru", /^(?:pru|px\.? ?revient|prix de revient|pam)$/i],
  ["cours", /^(?:cours|dernier|dernier cours)$/i],
  ["valeur", /^(?:valo\.?|valorisation|montant|valeur totale)$/i],
  ["variation", /^(?:\+\s?[/lI1|]\s?-\s?val\.?|\+\/-.*|perf\.?|var\.?|%)$/i],
];

interface Column {
  field: Field;
  center: number;
  right: number;
}

const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/;
const NUMBER_TOKEN = /^[+\-−]?\d[\d.,]*$/;

function headerColumns(row: Row): Column[] | null {
  const columns: Column[] = [];
  for (const box of row.boxes) {
    const text = box.text.trim();
    const match = HEADER_WORDS.find(([, pattern]) => pattern.test(text));
    if (!match) continue;
    columns.push({ field: match[0], center: box.x + box.width / 2, right: box.x + box.width });
  }
  const numeric = columns.filter(
    (column) => column.field !== "nom" && column.field !== "variation",
  );
  if (numeric.length < 3 || !numeric.some((column) => column.field === "quantite")) return null;
  if (!columns.some((column) => column.field === "nom"))
    columns.unshift({ field: "nom", center: 0, right: 0 });
  return columns.sort((a, b) => a.center - b.center);
}

interface Token {
  text: string;
  center: number;
}

/** Mots d'une boîte, avec une position estimée d'après leur rang dans le texte. */
function tokens(box: OcrBox): Token[] {
  const text = box.text.trim();
  const result: Token[] = [];
  const re = /\S+/g;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    const middle = match.index + match[0].length / 2;
    result.push({
      text: match[0],
      center: box.x + (box.width * middle) / Math.max(1, text.length),
    });
  }
  return result;
}

function toNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[−–]/g, "-")
    .replace(/O/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/\s/g, "");
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function nearestColumn(columns: Column[], center: number): Column {
  // Nombres alignés à droite sous des en-têtes alignés à droite : on compare aussi les bords droits.
  return columns.reduce((best, column) =>
    Math.min(Math.abs(column.center - center), Math.abs(column.right - center)) <
    Math.min(Math.abs(best.center - center), Math.abs(best.right - center))
      ? column
      : best,
  );
}

export function readTable(rows: Row[]): PositionLine[] | null {
  const headerIndex = rows.findIndex((row) => headerColumns(row) !== null);
  if (headerIndex < 0) return null;
  const columns = headerColumns(rows[headerIndex]!)!;
  const firstNumeric = columns.find((column) => column.field !== "nom")!;
  const nameLimit = firstNumeric.center - (firstNumeric.right - firstNumeric.center) * 2.5;

  const positions: PositionLine[] = [];
  let current: {
    name: string[];
    isin: string | null;
    cells: Partial<Record<Field, string[]>>;
  } | null = null;

  const flush = () => {
    if (!current) return;
    const value = (field: Field) => {
      const parts = current!.cells[field];
      return parts?.length ? toNumber(parts.join("")) : null;
    };
    const quantite = value("quantite");
    const valeur = value("valeur");
    const name = current.name.join(" ").replace(/\s+/g, " ").trim();
    if (name && quantite !== null && valeur !== null) {
      const cours = value("cours");
      const consistent =
        cours !== null && Math.abs(quantite * cours - valeur) / Math.max(valeur, 0.01) <= 0.02;
      positions.push({
        nom: name,
        isin: current.isin,
        ticker: null,
        quantite: Math.abs(quantite),
        pru: value("pru") !== null ? Math.abs(value("pru")!) : null,
        cours: cours !== null ? Math.abs(cours) : null,
        valeur: Math.abs(valeur),
        devise: "EUR",
        confiance: Math.min(0.98, 0.6 + (current.isin ? 0.2 : 0) + (consistent ? 0.18 : 0)),
      });
    }
    current = null;
  };

  for (const row of rows.slice(headerIndex + 1)) {
    if (/\b(?:total|esp[èe]ces|liquidit[ée]s|valorisation totale|solde)\b/i.test(row.text)) {
      flush();
      continue;
    }
    const isin = row.text.match(ISIN_RE)?.[0];
    const words = row.boxes.flatMap(tokens);
    const nameWords: string[] = [];
    const cells: Partial<Record<Field, string[]>> = {};
    for (const word of words) {
      if (isin && word.text.includes(isin)) continue;
      if (NUMBER_TOKEN.test(word.text) && word.center > nameLimit) {
        const column = nearestColumn(columns, word.center);
        if (column.field === "nom") nameWords.push(word.text);
        else (cells[column.field] ??= []).push(word.text);
      } else {
        nameWords.push(word.text);
      }
    }
    const hasValues = Object.keys(cells).some((field) => field !== "variation");
    if (hasValues) {
      flush();
      current = { name: nameWords, isin: isin && isValidIsin(isin) ? isin : null, cells };
    } else if (current) {
      if (isin && isValidIsin(isin) && !current.isin) current.isin = isin;
      else if (nameWords.length) current.name.push(...nameWords);
    }
  }
  flush();
  return positions.length ? positions : null;
}
