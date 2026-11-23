import type { ImportExtraction, PositionLine } from "./import-positions";

/**
 * Analyse locale du texte d'une page de positions (OCR sur le téléphone
 * ou texte copié via « Live Text »). Aucune donnée ne quitte l'appareil.
 *
 * Difficulté principale : les espaces servent à la fois de séparateur de
 * milliers (« 18 931,60 ») et de séparateur de colonnes (« 38 452,13 »
 * = quantité 38, PRU 452,13). Chaque groupe de chiffres ambigu est donc
 * interprété de toutes les façons possibles, et l'on garde celle qui
 * respecte le mieux les en-têtes et la règle quantité × cours ≈ valeur.
 */

const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/g;
const DATE_RE = /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b|\b\d{1,2}[:h]\d{2}\b/g;
// \b ne connaît pas les lettres accentuées : on utilise des bornes explicites.
const END = "(?![0-9A-Za-zÀ-ÿ])";
const SUMMARY_RE = new RegExp(
  `(?<![A-Za-zÀ-ÿ])(?:total|sous-total|solde esp[eè]ces|esp[eè]ces|liquidit[eé]s?|plus.?values? latentes? totales?|valorisation totale|plafond|frais)${END}`,
  "i",
);
const UI_NOISE_RE =
  /^(?:(?:(?:mon|mes|PEA|PME|CTO|compte|titres?|ordinaire|portefeuille|positions?)[\s-]*)+|valeurs|actions|investissements?|voir (?:tout|plus|le d[ée]tail)|acheter|vendre|trier|filtrer|d[ée]tails?|performance|aujourd'hui|1j|1s|1m|6m|1a|ytd|max)$/i;
/** Début typique de la deuxième ligne d'un nom d'ETF coupé. */
const NAME_TAIL_RE = /^(?:UCITS|ETF|EUR|USD|ACC|DIST|ESG|SRI|DR|PEA|C|D|\(|-)(?![A-Za-zÀ-ÿ])/i;
const UNIT_RE = new RegExp(`^\\s*(?:actions?|parts?|titres?|act\\.|act|pts?|qt[eé]s?)${END}`, "i");
const SUFFIX_RE = /^\s*(€|eur\b|%)/i;
/** Un nombre : chaîne de milliers ambiguë ou nombre simple. Lettres OCR tolérées après un vrai chiffre. */
const NUMBER_RE = /(?:[+\-−–] ?)?\d[\dOIlS]{0,2}(?: [\dOIlS]{3})+(?:[.,][\dOIlS]+)?|(?:[+\-−–] ?)?\d[\dOIlS]*(?:[.,][\dOIlS]+)?/g;

type Field = "quantite" | "pru" | "cours" | "valeur";
type Column = Field | "variation";

interface Chunk {
  groups: string[]; // groupes séparés par une espace, chacun pouvant être joint au précédent
  sign: number;
  suffix: "money" | "pct" | "qty" | null;
}

interface Token {
  value: number;
  kind: "money" | "pct" | "qty" | "plain";
}

interface Mapped {
  values: Partial<Record<Field, number>>;
  score: number;
  consistent: boolean;
  computedCours: boolean;
}

export function parsePositionText(text: string, kind: "titres" | "solde"): ImportExtraction {
  const lines = text
    .replace(/[   ]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ ]{2,}/g, "\t").trim())
    .filter(Boolean);
  if (kind === "solde") return parseSavings(lines);

  const allText = lines.join(" ");
  const enveloppe = /\bPEA\b/.test(allText)
    ? "PEA"
    : /\b(?:CTO|compte[ -]titres?)\b/i.test(allText)
      ? "CTO"
      : "inconnu";

  const headerIndex = lines.findIndex(isHeaderLine);
  const columns = headerIndex >= 0 ? headerColumns(lines[headerIndex]!) : [];
  const numericColumns = columns.filter((column) => column !== "variation") as Field[];

  const positions: PositionLine[] = [];
  const warnings: string[] = [];
  let name = "";
  let isin: string | null = null;
  let chunks: Chunk[] = [];
  let labeled: Partial<Record<Field, number>> = {};
  let pendingLabel: Column | null = null;

  const flush = () => {
    const hasNumbers = chunks.some((chunk) => chunk.suffix !== "pct");
    const hasLabels = Object.keys(labeled).length > 0;
    if (name && (hasNumbers || hasLabels)) {
      const best: Mapped = (hasNumbers ? bestInterpretation(chunks, numericColumns) : null) ?? {
        values: {},
        score: 0,
        consistent: false,
        computedCours: false,
      };
      if (hasLabels) {
        // Un champ étiqueté (« Quantité 12 ») est plus sûr qu'une colonne devinée.
        best.values = { ...best.values, ...labeled };
        if (!("cours" in labeled) && best.computedCours) delete best.values.cours;
        best.computedCours = false;
        completeCours(best);
        best.consistent = isConsistent(best.values) && !best.computedCours;
      }
      if (best.values.quantite != null || best.values.valeur != null) {
        positions.push({
          nom: name,
          isin,
          ticker: null,
          quantite: best.values.quantite ?? null,
          pru: best.values.pru ?? null,
          cours: best.values.cours ?? null,
          valeur: best.values.valeur ?? null,
          devise: "EUR",
          confiance: Math.min(
            0.98,
            0.4 +
              (isin ? 0.25 : 0) +
              (numericColumns.length || hasLabels ? 0.15 : 0) +
              (best.consistent ? 0.18 : 0) -
              (best.computedCours ? 0.08 : 0),
          ),
        });
        if (best.computedCours) {
          warnings.push(`${name} : cours déduit de la valorisation et de la quantité.`);
        }
      }
    }
    name = "";
    isin = null;
    chunks = [];
    labeled = {};
    pendingLabel = null;
  };

  const assignLabel = (label: Column, chunk: Chunk) => {
    if (label === "variation" || chunk.suffix === "pct") return;
    // Une valeur étiquetée est toujours un seul nombre : les espaces sont des milliers.
    const value = toNumber(chunk.groups.join(""));
    if (value !== null) labeled[label] = Math.abs(value);
  };

  lines.forEach((rawLine, index) => {
    if (index === headerIndex) return;
    if (SUMMARY_RE.test(rawLine)) {
      flush();
      return;
    }
    if (UI_NOISE_RE.test(rawLine)) return;

    const lineIsin =
      [...rawLine.matchAll(ISIN_RE)].map((match) => match[0]).find(isValidIsin) ?? null;
    // Ce qui précède l'ISIN est le nom, chiffres compris (« Lyxor CAC 40 FR0007052782 … »).
    const isinAt = lineIsin ? rawLine.indexOf(lineIsin) : -1;
    const namePrefix = isinAt > 0 ? rawLine.slice(0, isinAt) : "";
    const numericPart = (isinAt >= 0 ? rawLine.slice(isinAt + 12) : rawLine).replace(DATE_RE, " ");
    const extracted = extractChunks(numericPart);
    let lineChunks = extracted.chunks;
    let lineName = cleanName(`${namePrefix} ${extracted.rest}`);

    // Champ étiqueté : « Quantité 12 », « PRU 410,50 € », ou l'étiquette seule puis la valeur.
    const label = !lineIsin ? labelOf(extracted.rest.replace(/[|•·€%:]/g, " ").replace(/\s+/g, " ").trim()) : null;
    if (label) {
      const first = lineChunks.find((chunk) => chunk.suffix !== "pct");
      if (first) assignLabel(label, first);
      else pendingLabel = label;
      return;
    }
    if (pendingLabel && !lineName && lineChunks.length) {
      assignLabel(pendingLabel, lineChunks[0]!);
      pendingLabel = null;
      return;
    }
    pendingLabel = null;

    // « Amundi CAC 40 » seul sur sa ligne : le nombre fait partie du nom.
    const only = lineChunks[0];
    if (
      lineName &&
      !lineIsin &&
      !numericColumns.length &&
      lineChunks.length === 1 &&
      only &&
      only.suffix === null &&
      only.groups.length === 1 &&
      /^\d{1,4}$/.test(only.groups[0]!)
    ) {
      lineName = cleanName(rawLine);
      lineChunks = [];
    }

    if (lineName) {
      const continuesName =
        name &&
        !chunks.length &&
        !Object.keys(labeled).length &&
        !lineChunks.length &&
        !isin &&
        (NAME_TAIL_RE.test(lineName) || /[-&]$/.test(name)) &&
        name.length + lineName.length <= 70;
      if (continuesName) {
        // Nom sur deux lignes (« AMUNDI MSCI WORLD » puis « UCITS ETF EUR (C) »).
        name = `${name} ${lineName}`;
        return;
      }
      flush();
      name = lineName;
      isin = lineIsin;
    } else if (lineIsin && !isin) {
      isin = lineIsin;
    }
    chunks.push(...lineChunks);

    // Mise en page en tableau : une ligne complète suffit.
    if (numericColumns.length && lineChunks.length && lineName && countNonPct(chunks) >= 1) {
      const best = bestInterpretation(chunks, numericColumns);
      if (best && best.score >= 4) flush();
    }
  });
  flush();

  return {
    kind: "titres",
    enveloppe,
    lignes: positions,
    avertissements: positions.length
      ? warnings
      : [
          "Aucune ligne de position reconnue. Vérifie le texte ou utilise la sélection de texte de ton téléphone.",
        ],
  };
}

// --- Découpage des nombres -------------------------------------------------

function extractChunks(line: string): { chunks: Chunk[]; rest: string } {
  const chunks: Chunk[] = [];
  let rest = "";
  let cursor = 0;
  NUMBER_RE.lastIndex = 0;
  for (let match = NUMBER_RE.exec(line); match; match = NUMBER_RE.exec(line)) {
    const start = match.index;
    // Un nombre collé à des lettres (ex. « S&P500 », « 2x ») fait partie du nom.
    const before = line[start - 1] ?? " ";
    if (/[A-Za-zÀ-ÿ]/.test(before)) continue;
    let raw = match[0];
    let end = start + raw.length;
    const after = line.slice(end);
    if (/^[A-Za-zÀ-ÿ]/.test(after) && !UNIT_RE.test(after) && !SUFFIX_RE.test(after)) continue;

    let suffix: Chunk["suffix"] = null;
    const suffixMatch = SUFFIX_RE.exec(after);
    const unitMatch = UNIT_RE.exec(after);
    if (suffixMatch) {
      suffix = suffixMatch[1] === "%" ? "pct" : "money";
      end += suffixMatch[0].length;
    } else if (unitMatch) {
      suffix = "qty";
      end += unitMatch[0].length;
    }
    // Un petit entier suivi d'un mot fait partie du nom (« S&P 500 UCITS », « CAC 40 ESG »).
    const nextWord = /^\s+([^\s]+)/.exec(after)?.[1] ?? "";
    if (
      suffix === null &&
      /^\d{1,4}$/.test(raw) &&
      /^[A-Za-zÀ-ÿ&'().-]*[A-Za-zÀ-ÿ]{2,}[A-Za-zÀ-ÿ&'().-]*$/.test(nextWord) &&
      !UNIT_RE.test(nextWord) &&
      !/^eur$/i.test(nextWord)
    ) {
      continue;
    }

    const signMatch = /^[+\-−–]\s?/.exec(raw);
    const sign = signMatch && /[-−–]/.test(signMatch[0]) ? -1 : 1;
    if (signMatch) raw = raw.slice(signMatch[0].length);

    rest += line.slice(cursor, start) + " ";
    cursor = end;
    chunks.push({ groups: raw.split(" "), sign, suffix });
  }
  rest += line.slice(cursor);
  return { chunks, rest };
}

/** Toutes les lectures d'un groupe : chaque espace est soit un séparateur de milliers, soit de colonnes. */
function chunkReadings(chunk: Chunk): Token[][] {
  const readings: Token[][] = [];
  const boundaries = chunk.groups.length - 1;
  const combos = Math.min(1 << boundaries, 64);
  for (let mask = 0; mask < combos; mask++) {
    const parts: string[] = [chunk.groups[0]!];
    for (let b = 0; b < boundaries; b++) {
      const next = chunk.groups[b + 1]!;
      if (mask & (1 << b)) parts.push(next);
      else parts[parts.length - 1] += next;
    }
    // Une jointure n'est valide que sur une tête de 1 à 3 chiffres sans décimales.
    if (!parts.every((part, i) => i === parts.length - 1 || !/[.,]/.test(part))) continue;
    const tokens = parts.map((part, i): Token | null => {
      const value = toNumber(part);
      if (value === null) return null;
      const last = i === parts.length - 1;
      const kind = last && chunk.suffix ? chunk.suffix : "plain";
      return { value: (i === 0 ? chunk.sign : 1) * value, kind };
    });
    if (tokens.every((token): token is Token => token !== null)) readings.push(tokens);
  }
  return readings;
}

function bestInterpretation(chunks: Chunk[], columns: Field[]): Mapped | null {
  const options = chunks.map(chunkReadings);
  let best: Mapped | null = null;
  const total = options.reduce((product, list) => product * Math.max(1, list.length), 1);
  const limit = Math.min(total, 512);
  for (let n = 0; n < limit; n++) {
    let rest = n;
    const tokens: Token[] = [];
    let splits = 0;
    options.forEach((list, i) => {
      if (!list.length) return;
      const pick = list[rest % list.length]!;
      rest = Math.floor(rest / list.length);
      tokens.push(...pick);
      splits += pick.length - 1;
      void i;
    });
    const mapped = mapTokens(tokens, columns);
    if (!mapped) continue;
    mapped.score -= splits * 0.5;
    if (!best || mapped.score > best.score) best = mapped;
  }
  return best;
}

function mapTokens(tokens: Token[], columns: Field[]): Mapped | null {
  const numbers = tokens.filter((token) => token.kind !== "pct");
  if (!numbers.length) return null;

  if (columns.length) {
    const values: Partial<Record<Field, number>> = {};
    columns.forEach((column, i) => {
      const token = numbers[i];
      if (token) values[column] = Math.abs(token.value);
    });
    let score = numbers.length === columns.length ? 4 : -2 * Math.abs(numbers.length - columns.length);
    const consistent = isConsistent(values);
    if (consistent) score += 6;
    // Une quantité porte rarement le symbole €.
    if (values.quantite != null && numbers[columns.indexOf("quantite")]?.kind === "money") score -= 1;
    return completeCours({ values, score, consistent, computedCours: false });
  }

  // Sans en-têtes : on cherche quantité × cours ≈ valeur.
  const qtyFirst = [
    ...numbers.filter((token) => token.kind === "qty"),
    ...numbers.filter((token) => token.kind === "plain"),
    ...numbers.filter((token) => token.kind === "money"),
  ];
  // On garde le triplet le plus exact : avec 2 % de tolérance, un PRU proche du cours passerait aussi.
  let bestTriplet: Mapped | null = null;
  for (const q of qtyFirst) {
    for (const c of numbers) {
      if (c === q) continue;
      for (const v of numbers) {
        if (v === q || v === c) continue;
        const values: Partial<Record<Field, number>> = {
          quantite: Math.abs(q.value),
          cours: Math.abs(c.value),
          valeur: Math.abs(v.value),
        };
        if (!isConsistent(values)) continue;
        const error = Math.abs(values.quantite! * values.cours! - values.valeur!) / Math.max(values.valeur!, 0.01);
        const pru = numbers.find((token) => token !== q && token !== c && token !== v);
        if (pru) values.pru = Math.abs(pru.value);
        let score = 8 - error * 300;
        if (q.kind === "money") score -= 3;
        if (q.kind === "qty") score += 1;
        // Ordre habituel des cartes mobiles : PRU, cours, valeur.
        if (pru && numbers.indexOf(pru) < numbers.indexOf(c)) score += 0.5;
        if (!bestTriplet || score > bestTriplet.score) {
          bestTriplet = { values, score, consistent: true, computedCours: false };
        }
      }
    }
  }
  if (bestTriplet) return bestTriplet;

  const quantity = numbers.find((token) => token.kind === "qty") ?? numbers.find((token) => token.kind === "plain");
  const money = numbers.filter((token) => token !== quantity);
  const values: Partial<Record<Field, number>> = {};
  if (quantity) values.quantite = Math.abs(quantity.value);
  if (money.length === 1) values.valeur = Math.abs(money[0]!.value);
  else if (money.length === 2) {
    values.pru = Math.abs(money[0]!.value);
    values.valeur = Math.abs(money[1]!.value);
  } else if (money.length >= 3) {
    values.pru = Math.abs(money[0]!.value);
    values.cours = Math.abs(money[1]!.value);
    values.valeur = Math.abs(money[2]!.value);
  }
  let score = 0;
  if (quantity?.kind === "plain" && numbers.some((token) => token.kind === "qty")) score -= 2;
  // Découper un montant en euros crée un nombre « nu » suspect quand la quantité est déjà connue.
  if (numbers.filter((token) => token.kind === "plain").length > (quantity?.kind === "plain" ? 1 : 0)) score -= 2;
  return completeCours({ values, score, consistent: false, computedCours: false });
}

function completeCours(mapped: Mapped): Mapped {
  const { quantite, valeur, cours } = mapped.values;
  if (cours == null && quantite && valeur) {
    mapped.values.cours = Math.round((valeur / quantite) * 10_000) / 10_000;
    mapped.computedCours = true;
  }
  return mapped;
}

function isConsistent(values: Partial<Record<Field, number>>): boolean {
  const { quantite, cours, valeur } = values;
  if (!quantite || !cours || !valeur) return false;
  return Math.abs(quantite * cours - valeur) / Math.max(valeur, 0.01) <= 0.02;
}

function countNonPct(chunks: Chunk[]): number {
  return chunks.filter((chunk) => chunk.suffix !== "pct").length;
}

function toNumber(raw: string): number | null {
  if (!/\d/.test(raw)) return null;
  let value = raw.replace(/O/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5");
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) return null;
  value = value.replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- En-têtes ---------------------------------------------------------------

const word = (source: string) => new RegExp(`(?<![A-Za-zÀ-ÿ])(?:${source})${END}`, "i");
const HEADER_SPECS: Array<[Column, RegExp]> = [
  ["quantite", word("qt[eé]s?|quantit[eé]s?|nb|nombre")],
  ["pru", word("pru|prix de revient|prix moyen|pam")],
  ["cours", word("cours|dernier|prix actuel")],
  ["valeur", word("valorisation|montant|valeur")],
  ["variation", /(?:\+\s*\/\s*-|plus.?values?|moins.?values?|variation|perf|gains?|\bpv\b)/i],
];

function isHeaderLine(line: string): boolean {
  return !/\d/.test(line) && HEADER_SPECS.filter(([, pattern]) => pattern.test(line)).length >= 2;
}

/** Une ligne dont le texte n'est qu'une étiquette de champ (« Quantité », « Dernier cours »…). */
function labelOf(text: string): Column | null {
  if (!text || text.split(" ").length > 4) return null;
  const stripped = text
    .replace(/(?<![A-Za-zÀ-ÿ])(?:unitaire|d[ée]tenue?s?|de parts|de titres|actuel(?:le)?|latente?s?|totale?|moyen|values?|eur)(?![A-Za-zÀ-ÿ])/gi, " ")
    .replace(/[():]/g, " ")
    .trim();
  const matches = HEADER_SPECS.filter(([, pattern]) => pattern.test(stripped));
  if (matches.length !== 1) return null;
  const [column, pattern] = matches[0]!;
  // L'étiquette doit couvrir l'essentiel du texte, pour ne pas confondre un nom de titre.
  const rest = stripped.replace(new RegExp(pattern.source, "gi"), "").replace(/[\s\-/+]/g, "");
  return rest.length <= 2 ? column : null;
}

function headerColumns(header: string): Column[] {
  const found: Array<{ column: Column; index: number }> = [];
  for (const [column, pattern] of HEADER_SPECS) {
    const global = new RegExp(pattern.source, "gi");
    for (const match of header.matchAll(global)) found.push({ column, index: match.index ?? 0 });
  }
  found.sort((a, b) => a.index - b.index);
  // « Valeur » en tête de ligne désigne le titre (colonne du nom), pas la valorisation.
  if (found[0]?.column === "valeur" && found[0].index < 3) found.shift();
  const seen = new Set<Column>();
  return found
    .filter(({ column }) => {
      if (column === "variation") return true;
      if (seen.has(column)) return false;
      seen.add(column);
      return true;
    })
    .map(({ column }) => column);
}

// --- Utilitaires ------------------------------------------------------------

function cleanName(value: string): string {
  return value
    .replace(/[|•·€%]/g, " ")
    .replace(UNIT_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:–+\-]+|[\s:–+\-]+$/g, "")
    .trim();
}

export function isValidIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const expanded = [...isin]
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join("");
  let sum = 0;
  let double = false;
  for (let index = expanded.length - 1; index >= 0; index--) {
    let digit = Number(expanded[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function parseSavings(lines: string[]): Extract<ImportExtraction, { kind: "solde" }> {
  const label = lines.find((line) => /livret\s*a\b/i.test(line)) ?? lines.find((line) => /livret|ldds|lep/i.test(line)) ?? "Livret A";
  const excluded = /plafond|taux|int[eé]r[eê]ts?|versement|retrait/i;
  const amountsOf = (line: string): number[] => {
    const { chunks } = extractChunks(line.replace(DATE_RE, " "));
    // Sur un écran de livret, un groupe de chiffres est toujours un seul montant.
    return chunks
      .filter((chunk) => chunk.suffix !== "pct")
      .map((chunk) => toNumber(chunk.groups.join("")))
      .filter((value): value is number => value !== null);
  };

  let solde: number | null = null;
  let confiance = 0;
  for (let i = 0; i < lines.length && solde === null; i++) {
    const line = lines[i]!;
    if (!/\b(?:solde|montant disponible|disponible|encours)\b/i.test(line) || excluded.test(line)) continue;
    const inline = amountsOf(line.replace(/.*?\b(?:solde|montant disponible|disponible|encours)\b/i, ""));
    if (inline.length) {
      solde = inline[0]!;
      confiance = 0.95;
      break;
    }
    for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
      if (excluded.test(lines[j]!)) continue;
      const next = amountsOf(lines[j]!);
      if (next.length) {
        solde = next[0]!;
        confiance = 0.9;
        break;
      }
    }
  }
  if (solde === null) {
    const index = lines.findIndex((line) => /livret/i.test(line));
    for (let j = index + 1; index >= 0 && j < lines.length; j++) {
      if (excluded.test(lines[j]!)) continue;
      const amounts = amountsOf(lines[j]!);
      if (amounts.length) {
        solde = amounts[0]!;
        confiance = 0.7;
        break;
      }
    }
  }
  return {
    kind: "solde",
    libelle: cleanName(label) || "Livret A",
    solde,
    confiance,
    avertissements: solde === null ? ["Solde introuvable : vérifie le texte collé."] : [],
  };
}
