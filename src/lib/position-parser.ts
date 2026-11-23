import type { ImportExtraction, PositionLine } from "./import-positions";

/**
 * Analyse locale du texte d'une page de positions (OCR sur le téléphone
 * ou texte copié via « Live Text »). Aucune donnée ne quitte l'appareil.
 *
 * Mises en page gérées :
 * - tableaux avec en-têtes, une ligne par titre (export web, Boursorama web…) ;
 * - cartes mobiles : nom sur une ou plusieurs lignes, puis les chiffres
 *   (appli Boursorama, Trade Republic…) ;
 * - fiches détaillées avec étiquettes (« Quantité 12 », « PRU 150 € »…).
 *
 * L'OCR est imparfait : les espaces servent à la fois de séparateur de
 * milliers et de colonnes, la virgule décimale disparaît parfois
 * (« 1122440€ » pour 11 224,40 €), le % devient ” ou *. Chaque nombre
 * ambigu est donc lu de toutes les façons plausibles et l'on garde la
 * lecture qui vérifie quantité × cours ≈ valeur, puis
 * (cours − PRU) × quantité ≈ plus-value quand elle est affichée.
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
const UNIT_RE = new RegExp(`^\\s*(?:actions?|parts?|titres?|act\\.|act|pts?|qt[eé]s?)${END}`, "i");
const SUFFIX_RE = /^\s*(€|eur\b|%)/i;
/** Un nombre : chaîne de milliers ambiguë ou nombre simple. Lettres OCR tolérées après un vrai chiffre. */
const NUMBER_RE = /(?:[+\-−–] ?)?\d[\dOIlS]{0,2}(?: [\dOIlS]{3})+(?:[.,][\dOIlS]+)?|(?:[+\-−–] ?)?\d[\dOIlS]*(?:[.,][\dOIlS]+)?/g;
const MAX_NAME_LENGTH = 110;

type Field = "quantite" | "pru" | "cours" | "valeur";
type Column = Field | "variation";

interface Chunk {
  groups: string[]; // groupes séparés par une espace, chacun pouvant être joint au précédent
  sign: number;
  signed: boolean; // + ou − explicite : variation ou plus-value, jamais une quantité ni un cours
  suffix: "money" | "pct" | "qty" | null;
}

interface Token {
  value: number;
  /** delta = montant signé en € (plus-value), pct = variation en %. */
  kind: "money" | "pct" | "qty" | "plain" | "delta";
}

interface Reading {
  tokens: Token[];
  penalty: number;
}

interface Mapped {
  values: Partial<Record<Field, number>>;
  score: number;
  consistent: boolean;
  computedCours: boolean;
  pvMatched: boolean;
  unitQuantity: boolean;
}

interface ParseResult {
  positions: PositionLine[];
  warnings: string[];
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

  // On essaie sans en-têtes (cartes) et avec (tableau), et l'on garde la lecture la plus complète.
  const candidates: ParseResult[] = [parseLines(lines, -1, [])];
  const headerIndex = lines.findIndex(isHeaderLine);
  if (headerIndex >= 0) {
    const columns = headerColumns(lines[headerIndex]!).filter((column) => column !== "variation") as Field[];
    if (columns.length >= 2) candidates.push(parseLines(lines, headerIndex, columns));
  }
  const quality = (result: ParseResult) =>
    result.positions.length * 10 + result.positions.reduce((sum, line) => sum + line.confiance, 0);
  const best = candidates.reduce((a, b) => (quality(b) > quality(a) ? b : a));

  return {
    kind: "titres",
    enveloppe,
    lignes: best.positions,
    avertissements: best.positions.length
      ? best.warnings
      : [
          "Aucune ligne de position reconnue. Essaie une capture plus nette ou « Coller le texte » avec la sélection de texte du téléphone.",
          ...best.warnings,
        ],
  };
}

function parseLines(lines: string[], headerIndex: number, numericColumns: Field[]): ParseResult {
  const positions: PositionLine[] = [];
  const warnings: string[] = [];
  let name = "";
  let isin: string | null = null;
  let chunks: Chunk[] = [];
  let labeled: Partial<Record<Field, number>> = {};
  let pendingLabel: Column | null = null;
  /** Vrai tant que les lignes lues après le nom en font encore partie (nom sur plusieurs lignes). */
  let nameOpen = false;

  const flush = () => {
    const hasNumbers = chunks.some((chunk) => !chunk.signed && chunk.suffix !== "pct");
    const hasLabels = Object.keys(labeled).length > 0;
    if (name && (hasNumbers || hasLabels)) {
      const best: Mapped = (hasNumbers ? bestInterpretation(chunks, numericColumns) : null) ?? emptyMapped();
      if (hasLabels) {
        // Un champ étiqueté (« Quantité 12 ») est plus sûr qu'une colonne devinée.
        best.values = { ...best.values, ...labeled };
        if (!("cours" in labeled) && best.computedCours) delete best.values.cours;
        best.computedCours = false;
        completeCours(best);
        best.consistent = isConsistent(best.values) && !best.computedCours;
      }
      const { quantite, valeur } = best.values;
      const trusted =
        best.consistent ||
        (hasLabels && (quantite != null || valeur != null)) ||
        (best.unitQuantity && valeur != null) ||
        (isin !== null && (quantite != null || valeur != null));
      if (trusted && (quantite != null || valeur != null)) {
        positions.push({
          nom: name,
          isin,
          ticker: null,
          quantite: quantite ?? null,
          pru: best.values.pru ?? null,
          cours: best.values.cours ?? null,
          valeur: valeur ?? null,
          devise: "EUR",
          confiance: Math.min(
            0.98,
            0.4 +
              (isin ? 0.25 : 0) +
              (numericColumns.length || hasLabels ? 0.15 : 0) +
              (best.consistent ? 0.18 : 0) +
              (best.pvMatched ? 0.15 : 0) -
              (best.computedCours ? 0.08 : 0),
          ),
        });
        if (best.computedCours) {
          warnings.push(`${name} : cours déduit de la valorisation et de la quantité.`);
        }
      } else if (chunks.filter((chunk) => chunk.suffix === "money" && !chunk.signed).length >= 2) {
        warnings.push(`${name} : chiffres illisibles ou incohérents, ligne non importée.`);
      }
    }
    name = "";
    isin = null;
    chunks = [];
    labeled = {};
    pendingLabel = null;
    nameOpen = false;
  };

  const assignLabel = (label: Column, chunk: Chunk) => {
    if (label === "variation" || chunk.signed || chunk.suffix === "pct") return;
    // Une valeur étiquetée est toujours un seul nombre : les espaces sont des milliers.
    const value = toNumber(chunk.groups.join(""));
    if (value !== null) labeled[label] = value;
  };

  lines.forEach((rawLine, index) => {
    if (index === headerIndex || SUMMARY_RE.test(rawLine)) {
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
    const label = lineIsin ? null : labelOf(extracted.rest.replace(/[|•·€%:]/g, " ").replace(/\s+/g, " ").trim());
    if (label) {
      nameOpen = false;
      const first = lineChunks.find((chunk) => !chunk.signed && chunk.suffix !== "pct");
      if (first) assignLabel(label, first);
      else if (!lineChunks.length) pendingLabel = label;
      return;
    }
    // Ligne d'en-têtes de colonnes (« Cours +/- latentes (€) », « Px. revient / Quantité »).
    if (!lineChunks.length && !lineIsin && isHeaderish(rawLine)) {
      flush();
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
      !only.signed &&
      only.groups.length === 1 &&
      /^\d{1,4}$/.test(only.groups[0]!)
    ) {
      lineName = cleanName(rawLine);
      lineChunks = [];
    }

    if (lineName) {
      const continuesName =
        name &&
        nameOpen &&
        !Object.keys(labeled).length &&
        !hasQuantityAndAmount(chunks) &&
        !(lineIsin && isin) &&
        name.length + lineName.length < MAX_NAME_LENGTH;
      if (continuesName) {
        // Nom sur plusieurs lignes ; le montant peut être à droite de l'une d'elles.
        name = `${name} ${lineName}`;
        if (lineIsin) isin = lineIsin;
      } else {
        flush();
        name = lineName;
        isin = lineIsin;
        nameOpen = true;
      }
    } else {
      if (lineIsin && !isin) isin = lineIsin;
      if (lineChunks.length) nameOpen = false;
    }
    chunks.push(...lineChunks);

    // Mise en page en tableau : une ligne complète suffit.
    if (numericColumns.length && lineChunks.length && lineName && chunks.some((chunk) => !chunk.signed)) {
      const best = bestInterpretation(chunks, numericColumns);
      if (best && best.score >= 4) flush();
    }
  });
  flush();
  return { positions, warnings };
}

function emptyMapped(): Mapped {
  return { values: {}, score: 0, consistent: false, computedCours: false, pvMatched: false, unitQuantity: false };
}

/** Une quantité et un montant sont déjà connus : une nouvelle ligne de texte est un autre titre. */
function hasQuantityAndAmount(chunks: Chunk[]): boolean {
  const plain = chunks.some((chunk) => !chunk.signed && (chunk.suffix === "qty" || chunk.suffix === null));
  const money = chunks.some((chunk) => !chunk.signed && chunk.suffix === "money");
  return plain && money;
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
    chunks.push({ groups: raw.split(" "), sign, signed: Boolean(signMatch), suffix });
  }
  rest += line.slice(cursor);
  return { chunks, rest };
}

/**
 * Toutes les lectures plausibles d'un groupe de chiffres : chaque espace est un séparateur
 * de milliers ou de colonnes, et un montant en € sans décimales a peut-être perdu sa virgule.
 */
function chunkReadings(chunk: Chunk): Reading[] {
  const readings: Reading[] = [];
  if (chunk.signed) {
    // Variation ou plus-value : un seul nombre, jamais découpé.
    const value = toNumber(chunk.groups.join(""));
    if (value === null) return [];
    const kind: Token["kind"] = chunk.suffix === "money" ? "delta" : "pct";
    readings.push({ tokens: [{ value: chunk.sign * value, kind }], penalty: 0 });
    if (kind === "delta" && !/[.,]/.test(chunk.groups.join("")) && value >= 100) {
      readings.push({ tokens: [{ value: (chunk.sign * value) / 100, kind }], penalty: 0.3 });
    }
    return readings;
  }

  const boundaries = chunk.groups.length - 1;
  const combos = Math.min(1 << boundaries, 64);
  for (let mask = 0; mask < combos; mask++) {
    const parts: string[] = [chunk.groups[0]!];
    let splits = 0;
    for (let b = 0; b < boundaries; b++) {
      const next = chunk.groups[b + 1]!;
      if (mask & (1 << b)) {
        parts.push(next);
        splits++;
      } else parts[parts.length - 1] += next;
    }
    // Une jointure n'est valide que sur une tête de 1 à 3 chiffres sans décimales.
    if (!parts.every((part, i) => i === parts.length - 1 || !/[.,]/.test(part))) continue;
    const values = parts.map(toNumber);
    if (values.some((value) => value === null)) continue;
    const tokens: Token[] = values.map((value, i) => ({
      value: value!,
      kind: i === parts.length - 1 && chunk.suffix ? chunk.suffix : "plain",
    }));
    const last = parts[parts.length - 1]!;
    const lastToken = tokens[tokens.length - 1]!;
    const missingComma = lastToken.kind === "money" && !/[.,]/.test(last) && /^0|^\d{3,}$/.test(last.replace(/\D/g, ""));
    const leadingZero = /^0\d/.test(last);
    readings.push({ tokens, penalty: splits * 0.5 + (leadingZero ? 3 : 0) });
    if (missingComma) {
      // « 1122440€ » = 11 224,40 € ; « 010 € » = 0,10 €.
      readings.push({
        tokens: [...tokens.slice(0, -1), { value: lastToken.value / 100, kind: "money" }],
        penalty: splits * 0.5 + 0.7,
      });
    }
  }
  return readings;
}

function bestInterpretation(chunks: Chunk[], columns: Field[]): Mapped | null {
  const options = chunks.map(chunkReadings).filter((list) => list.length);
  if (!options.length) return null;
  let best: Mapped | null = null;
  const total = options.reduce((product, list) => product * list.length, 1);
  const limit = Math.min(total, 2048);
  for (let n = 0; n < limit; n++) {
    let rest = n;
    const tokens: Token[] = [];
    let penalty = 0;
    for (const list of options) {
      const pick = list[rest % list.length]!;
      rest = Math.floor(rest / list.length);
      tokens.push(...pick.tokens);
      penalty += pick.penalty;
    }
    const mapped = mapTokens(tokens, columns);
    if (!mapped) continue;
    mapped.score -= penalty;
    if (!best || mapped.score > best.score) best = mapped;
  }
  return best;
}

function mapTokens(tokens: Token[], columns: Field[]): Mapped | null {
  const numbers = tokens.filter((token) => token.kind === "money" || token.kind === "plain" || token.kind === "qty");
  const deltas = tokens.filter((token) => token.kind === "delta");
  if (!numbers.length) return null;

  if (columns.length) {
    const values: Partial<Record<Field, number>> = {};
    columns.forEach((column, i) => {
      const token = numbers[i];
      if (token) values[column] = token.value;
    });
    let score = numbers.length === columns.length ? 4 : -2 * Math.abs(numbers.length - columns.length);
    const consistent = isConsistent(values);
    if (consistent) score += 6;
    // Une quantité porte rarement le symbole €.
    if (values.quantite != null && numbers[columns.indexOf("quantite")]?.kind === "money") score -= 1;
    return completeCours({ ...emptyMapped(), values, score, consistent });
  }

  // Sans en-têtes : on cherche quantité × cours ≈ valeur, en gardant le triplet le plus exact
  // (avec 2 % de tolérance, un PRU proche du cours passerait aussi).
  const qtyFirst = [
    ...numbers.filter((token) => token.kind === "qty"),
    ...numbers.filter((token) => token.kind === "plain"),
    ...numbers.filter((token) => token.kind === "money"),
  ];
  let bestTriplet: Mapped | null = null;
  for (const q of qtyFirst) {
    for (const c of numbers) {
      if (c === q || c.kind === "qty") continue;
      for (const v of numbers) {
        if (v === q || v === c || v.kind === "qty") continue;
        const values: Partial<Record<Field, number>> = { quantite: q.value, cours: c.value, valeur: v.value };
        if (!isConsistent(values)) continue;
        const error = Math.abs(q.value * c.value - v.value) / Math.max(v.value, 0.01);
        const remaining = numbers.filter((token) => token !== q && token !== c && token !== v);
        const { pru, pvMatched } = pickPru(q.value, c.value, remaining, deltas);
        if (pru) values.pru = pru.value;
        let score = 8 - error * 300;
        if (q.kind === "money") score -= 3;
        if (q.kind === "qty") score += 1;
        if (pvMatched) score += 2;
        // Ordre habituel des cartes mobiles : PRU, cours, valeur.
        else if (pru && numbers.indexOf(pru) < numbers.indexOf(c)) score += 0.5;
        if (!bestTriplet || score > bestTriplet.score) {
          bestTriplet = { values, score, consistent: true, computedCours: false, pvMatched, unitQuantity: q.kind === "qty" };
        }
      }
    }
  }
  if (bestTriplet) return bestTriplet;

  const quantity = numbers.find((token) => token.kind === "qty") ?? numbers.find((token) => token.kind === "plain");
  const money = numbers.filter((token) => token !== quantity);
  const values: Partial<Record<Field, number>> = {};
  if (quantity) values.quantite = quantity.value;
  if (money.length === 1) values.valeur = money[0]!.value;
  else if (money.length === 2) {
    values.pru = money[0]!.value;
    values.valeur = money[1]!.value;
  } else if (money.length >= 3) {
    values.pru = money[0]!.value;
    values.cours = money[1]!.value;
    values.valeur = money[2]!.value;
  }
  let score = 0;
  if (quantity?.kind === "plain" && numbers.some((token) => token.kind === "qty")) score -= 2;
  // Découper un montant en euros crée un nombre « nu » suspect quand la quantité est déjà connue.
  if (numbers.filter((token) => token.kind === "plain").length > (quantity?.kind === "plain" ? 1 : 0)) score -= 2;
  return completeCours({ ...emptyMapped(), values, score, unitQuantity: quantity?.kind === "qty" });
}

/**
 * Le PRU parmi les nombres restants : celui pour lequel (cours − PRU) × quantité retombe sur
 * la plus-value affichée ; à défaut, celui dont l'ordre de grandeur est le plus proche du cours.
 */
function pickPru(quantity: number, cours: number, remaining: Token[], deltas: Token[]): { pru: Token | null; pvMatched: boolean } {
  const candidates = remaining.filter((token) => token.kind !== "qty" && token.value > 0);
  for (const candidate of candidates) {
    const expected = Math.abs((cours - candidate.value) * quantity);
    const shown = [...deltas, ...remaining.filter((token) => token !== candidate && token.kind === "money")];
    const tolerance = (value: number) => Math.max(Math.abs(value) * 0.02, quantity * 0.011, 0.05);
    if (expected > 0.05 && shown.some((token) => Math.abs(Math.abs(token.value) - expected) <= tolerance(token.value))) {
      return { pru: candidate, pvMatched: true };
    }
  }
  let pru: Token | null = null;
  for (const candidate of candidates) {
    const distance = Math.abs(Math.log(candidate.value / cours));
    if (!pru || distance < Math.abs(Math.log(pru.value / cours))) pru = candidate;
  }
  return { pru, pvMatched: false };
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
  ["pru", word("pru|px\\.? ?(?:de )?revient|prix de revient|prix moyen|pam")],
  ["cours", word("dernier cours|cours|dernier|prix actuel")],
  ["valeur", word("valorisation|montant|valeur")],
  ["variation", /(?:\+\s*\/\s*-|plus.?values?|moins.?values?|variation|perf|gains?|\bpv\b)/i],
];
const HEADER_FILLER_RE =
  /(?<![A-Za-zÀ-ÿ])(?:px|prix|revient|latentes?|unitaire|actuel(?:le)?|moyen|values?|eur|euros?|de|du|des|la|le|en|par|achat)(?![A-Za-zÀ-ÿ])/gi;

function isHeaderLine(line: string): boolean {
  return !/\d/.test(line) && HEADER_SPECS.filter(([, pattern]) => pattern.test(line)).length >= 2;
}

/** Ligne faite uniquement d'intitulés de colonnes. */
function isHeaderish(line: string): boolean {
  if (/\d/.test(line)) return false;
  let hits = 0;
  let rest = line;
  for (const [, pattern] of HEADER_SPECS) {
    rest = rest.replace(new RegExp(pattern.source, "gi"), () => {
      hits++;
      return " ";
    });
  }
  rest = rest.replace(HEADER_FILLER_RE, " ").replace(/[^A-Za-zÀ-ÿ]/g, "");
  return hits >= 1 && rest.length <= 2;
}

/** Une ligne dont le texte n'est qu'une seule étiquette de champ (« Quantité », « Dernier cours »…). */
function labelOf(text: string): Column | null {
  if (!text || text.split(" ").length > 4) return null;
  const stripped = text
    .replace(/(?<![A-Za-zÀ-ÿ])(?:unitaire|d[ée]tenue?s?|de parts|de titres|actuel(?:le)?|latente?s?|totale?|moyen|values?|eur)(?![A-Za-zÀ-ÿ])/gi, " ")
    .replace(/[():]/g, " ")
    .trim();
  const hits = HEADER_SPECS.flatMap(([column, pattern]) =>
    [...stripped.matchAll(new RegExp(pattern.source, "gi"))].map(() => column),
  );
  // Deux intitulés (« Valeur Montant ») = ligne d'en-têtes, pas une étiquette.
  if (hits.length !== 1) return null;
  const column = hits[0]!;
  const pattern = HEADER_SPECS.find(([candidate]) => candidate === column)![1];
  // L'étiquette doit couvrir l'essentiel du texte, pour ne pas confondre un nom de titre.
  const rest = stripped.replace(new RegExp(pattern.source, "gi"), "").replace(/[\s\-/+.]/g, "");
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

/** Nom nettoyé, ou chaîne vide si ce n'est que du bruit (flèches lues « A », chevrons, guillemets…). */
function cleanName(value: string): string {
  const name = value
    .replace(/[|•·€%<>›»”“"*°]/g, " ")
    .replace(UNIT_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:–+\-/]+|[\s:–+\-/]+$/g, "")
    .trim();
  return /[A-Za-zÀ-ÿ]{2,}/.test(name) ? name : "";
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
      .filter((chunk) => chunk.suffix !== "pct" && !chunk.signed)
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
