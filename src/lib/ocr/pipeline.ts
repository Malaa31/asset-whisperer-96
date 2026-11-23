import { detectCaptureKind } from "@/lib/capture-kind";
import { parsePositionText } from "@/lib/position-parser";
import type { CaptureSource } from "./expected";
import { checkPosition, checkTotal, type FieldFlags } from "./checks";
import { correctOcrText } from "./corrections";
import { dropInterfaceBoxes, groupRows, type OcrPage, type Row } from "./layout";
import { rewriteLabeledRows } from "./labels";
import { instrumentByIsin } from "./instruments";
import { resolveInstrument } from "./names";
import { readTable } from "./table";

/**
 * Pipeline commun à l'appli (navigateur) et à l'évaluation (Node), à partir des boîtes de l'OCR :
 * reconstruction des lignes et colonnes → type d'écran et courtier → lecture → rattachement
 * des noms au référentiel → total du compte → contrôles de cohérence.
 */

export interface PipelinePosition {
  nom: string;
  isin: string | null;
  quantite: number | null;
  pru: number | null;
  cours: number | null;
  valorisation: number | null;
  confiance: number;
  flags: FieldFlags;
}

export interface PipelineResult {
  kind: "positions" | "livret";
  broker: CaptureSource;
  enveloppe: "PEA" | "CTO" | null;
  libelle: string | null;
  total: number | null;
  totalFlag: string | null;
  positions: PipelinePosition[];
  text: string;
  warnings: string[];
}

const BROKER_SIGNS: Array<[CaptureSource, RegExp[]]> = [
  ["boursorama", [/px\.? ?revient/i, /latentes/i, /comptes\s+ordres\s+listes/i]],
  ["trade-republic", [/\d\s?titres?\b/i, /investissements/i, /depuis le d[ée]but/i]],
  ["fortuneo", [/mes positions/i, /value latente/i, /valorisation totale/i]],
  ["bourse-direct", [/au comptant/i, /total titres/i, /\bvalo\.?/i, /\+\/- ?val\./i]],
  ["degiro", [/\bP\/L\b/, /\bEUR\b/, /\bqt[ée]\s\d/i, /valeur totale/i]],
  [
    "credit-agricole",
    [/livret ?a\b/i, /plafond r[ée]glementaire/i, /[ée]pargne disponible/i, /mes comptes/i],
  ],
];

export function detectBroker(text: string): CaptureSource {
  let best: { source: CaptureSource; score: number } = { source: "autre", score: 0 };
  const compact = text.replace(/\s+/g, "");
  for (const [source, signs] of BROKER_SIGNS) {
    const score = signs.filter(
      (sign) =>
        sign.test(text) ||
        new RegExp(sign.source.replace(/ \??|\\s\??/g, ""), sign.flags).test(compact),
    ).length;
    if (score > best.score) best = { source, score };
  }
  return best.score >= 2 ? best.source : "autre";
}

/** Titres de section et commandes de tri : jamais un nom de titre. */
const SECTION_RE =
  /^\W*(?:investiss?e\s?m\s?ents?|mes investissements|positions|mes positions|trier|filtrer)\b.*$|trier\s?:\s?\w+\s*⌄?$/i;

const MONEY_RE = /(?<![\d,])(\d{1,3}(?:[ \u202f\u00a0.]\d{3})+|\d+)(?:,(\d{1,2}))?\s?(?:€|EUR\b)/g;

const LABELED_NUMBER_RE = /(?<![\d,])(\d{1,3}(?:[ \u202f\u00a0.]\d{3})+|\d+),(\d{2})(?![\d,])/g;

function amountsIn(text: string, labeled = false): number[] {
  // Après un intitulé explicite (« Valorisation totale 30 818,10 »), un nombre à deux décimales suffit.
  return [...text.matchAll(labeled ? LABELED_NUMBER_RE : MONEY_RE)].map((match) => {
    const integer = match[1]!.replace(/[ \u202f\u00a0.]/g, "");
    return Number(`${integer}.${match[2] ?? "0"}`);
  });
}

const TOTAL_LABELS = [
  /valorisation totale|valeur totale|total (?:du )?portefeuille|total du compte|valeur du portefeuille/i,
  /^\W*portef[a-z]{0,2}u[i1l]{1,2}e\W*$|solde/i,
];

/** Total du compte : un intitulé explicite, sinon le plus grand montant en tête d'écran. */
export function extractTotal(rows: Row[], positionsSum: number): number | null {
  for (const label of TOTAL_LABELS) {
    for (let i = 0; i < rows.length; i++) {
      const compact = rows[i]!.text.replace(/\s+/g, " ").replace(/^[Yy](?=alorisation)/, "V");
      if (
        !label.test(compact) &&
        !label.test(compact.replace(/(\w)(totale|du portefeuille)/i, "$1 $2"))
      )
        continue;
      const here = amountsIn(rows[i]!.text, true);
      const candidates = here.length ? here : rows[i + 1] ? amountsIn(rows[i + 1]!.text, true) : [];
      const fitting = candidates.filter((value) => value + 0.01 >= positionsSum);
      if (fitting.length) return Math.max(...fitting);
    }
  }
  // En-tête = lignes au-dessus de la première ligne de tableau ou du premier titre reconnu
  // (sinon un badge de plus-value mal lu, « ↗ 3 491,63 € » → « 73491,63 € », passerait pour le total).
  const boundary = rows.findIndex(
    (row) =>
      /\b(?:valeur|cours|quantit[ée]|qt[ée]|pru|montant|positions|investissements)\b/i.test(
        row.text,
      ) || resolveInstrument(row.text.replace(/[\d.,€%+\-/]+/g, " ")) !== null,
  );
  const header = rows.slice(0, boundary > 0 ? boundary : Math.max(3, Math.ceil(rows.length * 0.3)));
  const values = header
    .flatMap((row) => amountsIn(row.text))
    .filter((value) => value + 0.01 >= positionsSum);
  if (!values.length || positionsSum <= 0) return null;
  return Math.max(...values);
}

/** Texte collé (Live Text, raccourci iPhone) → pseudo-page : une boîte par ligne, même pipeline. */
export function pageFromText(text: string): OcrPage {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim());
  return {
    width: 1000,
    height: lines.length * 24,
    boxes: lines.map((line, index) => ({
      text: line,
      x: 0,
      y: index * 24,
      width: 1000,
      height: 18,
      confidence: 1,
    })),
  };
}

export function runPipelineOnOcr(page: OcrPage): PipelineResult {
  const cleaned = dropInterfaceBoxes({
    ...page,
    boxes: page.boxes.map((box) => ({ ...box, text: correctOcrText(box.text) })),
  });
  const rows = groupRows(cleaned.boxes).filter((row) => !SECTION_RE.test(row.text));
  const text = rewriteLabeledRows(rows).join("\n");
  const broker = detectBroker(text);
  const detected = detectCaptureKind(text);
  const warnings: string[] = [];

  if (detected === "solde" || broker === "credit-agricole") {
    const savings = parsePositionText(text, "solde");
    const solde = savings.kind === "solde" ? savings.solde : null;
    return {
      kind: "livret",
      broker,
      enveloppe: null,
      libelle: savings.kind === "solde" ? (savings.libelle ?? null) : null,
      total: solde,
      totalFlag: solde === null ? "Solde introuvable" : null,
      positions: [],
      text,
      warnings: savings.avertissements,
    };
  }

  const parsed = parsePositionText(text, "titres");
  // Tableau à en-têtes : lecture par colonnes (géométrie) et lecture du texte sont comparées
  // par leur cohérence interne (quantité × cours ≈ valorisation, ISIN lu) ; la plus cohérente l'emporte.
  const textLines = parsed.kind === "titres" ? parsed.lignes : [];
  const table = readTable(rows);
  const coherence = (candidates: typeof textLines) =>
    candidates.reduce((sum, line) => {
      const consistent =
        line.quantite &&
        line.cours &&
        line.valeur &&
        Math.abs(line.quantite * line.cours - line.valeur) / line.valeur <= 0.02;
      return sum + (consistent ? 1 : 0) + (line.isin ? 0.2 : 0);
    }, 0);
  const useTable = table !== null && coherence(table) > coherence(textLines);
  const lines = (useTable ? table : textLines).map((line) => ({
    ...line,
    isin: line.isin ?? null,
    pru: line.pru ?? null,
    cours: line.cours ?? null,
    valeur: line.valeur ?? null,
  }));
  if (!useTable) warnings.push(...parsed.avertissements);
  const positions: PipelinePosition[] = lines.map((line) => {
    const match = line.isin ? null : resolveInstrument(line.nom);
    const isin = line.isin ?? match?.instrument.isin ?? null;
    const coursDeduit =
      parsed.kind === "titres" &&
      parsed.avertissements.some((warning) => warning.startsWith(`${line.nom} : cours déduit`));
    // Plausibilité : un prix implicite ~100 fois trop haut pour ce titre = virgule perdue à la lecture.
    const reference = isin ? instrumentByIsin(isin) : undefined;
    const plausible = (price: number) =>
      reference && price >= reference.price / 5 && price <= reference.price * 5;
    const fix = (amount: number | null, perUnit: (value: number) => number) => {
      if (amount === null || !reference) return amount;
      if (!plausible(perUnit(amount)) && plausible(perUnit(amount / 100)))
        return Math.round(amount) / 100;
      return amount;
    };
    if (line.quantite) {
      line.valeur = fix(line.valeur, (value) => value / line.quantite!);
      line.cours = fix(line.cours, (value) => value);
      line.pru =
        line.pru !== null &&
        reference &&
        line.pru > reference.price * 20 &&
        Number.isInteger(line.pru)
          ? line.pru / 100
          : line.pru;
    }
    const flags = checkPosition({
      nom: line.nom,
      isin,
      quantite: line.quantite,
      pru: line.pru,
      cours: line.cours,
      valeur: line.valeur,
      nomReconnu: Boolean(line.isin || match),
      coursDeduit,
    });
    return {
      nom: match ? match.instrument.name : line.nom,
      isin,
      quantite: line.quantite,
      pru: line.pru,
      cours: line.cours,
      valorisation: line.valeur,
      confiance: line.confiance,
      flags,
    };
  });
  const sum = positions.reduce((acc, position) => acc + (position.valorisation ?? 0), 0);
  const total = extractTotal(rows, sum);
  return {
    kind: "positions",
    broker,
    enveloppe:
      parsed.kind === "titres" && parsed.enveloppe && parsed.enveloppe !== "inconnu"
        ? parsed.enveloppe
        : null,
    libelle: null,
    total,
    totalFlag: checkTotal(
      total,
      positions.map((position) => position.valorisation),
    ),
    positions,
    text,
    warnings: tidyWarnings(
      warnings,
      lines.map((line, index) => [line.nom, positions[index]!.nom] as const),
    ),
  };
}

/**
 * Avertissements lisibles : nom reconnu à la place du texte brut, et un seul message quand le cours
 * n'est pas affiché (il est alors déduit pour toutes les lignes, ce qui est normal chez certains courtiers).
 */
function tidyWarnings(
  warnings: string[],
  names: ReadonlyArray<readonly [string, string]>,
): string[] {
  const deduced = warnings.filter((warning) => / : cours déduit/.test(warning)).length;
  const others = warnings
    .filter((warning) => !/ : cours déduit/.test(warning))
    .map((warning) => {
      const named = names.find(([raw]) => raw && warning.startsWith(`${raw} :`));
      return named ? `${named[1]}${warning.slice(named[0].length)}` : warning;
    });
  if (deduced)
    others.unshift(
      deduced === 1
        ? "Cours absent de la capture : déduit de la valorisation et de la quantité (1 ligne)."
        : `Cours absent de la capture : déduit de la valorisation et de la quantité (${deduced} lignes).`,
    );
  return [...new Set(others)];
}
