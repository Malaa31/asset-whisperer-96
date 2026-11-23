import type { Asset } from "@/lib/types";
import { remainingCapital } from "@/lib/loans";

/**
 * Import d'un crédit depuis des captures d'écran, entièrement sur l'appareil.
 *
 * L'analyse ne dépend pas de la mise en page d'une banque : elle cherche des
 * couples « intitulé → valeur » (sur la même ligne, la valeur en dessous ou au
 * dessus, ou coupée sur plusieurs lignes), reconnaît les intitulés usuels des
 * banques françaises, puis vérifie et complète le tout avec les mathématiques
 * du crédit (intérêts du mois = capital restant × taux / 12, tableau
 * d'amortissement, lissage avec un prêt à taux zéro…).
 *
 * Plusieurs captures d'un même crédit (haut et bas de la page) sont fusionnées ;
 * les captures de crédits différents donnent des crédits distincts.
 */

export type LoanField =
  | "capitalInitial"
  | "capitalRestant"
  | "capitalRestantApres"
  | "taux"
  | "tauxEffectif"
  | "dureeMois"
  | "echeancesRestantes"
  | "dateFin"
  | "dateDebut"
  | "dateProchaine"
  | "echeance"
  | "mensualiteHorsAssurance"
  | "mensualiteAvecAssurance"
  | "assurance"
  | "interets"
  | "capitalAmorti";

type ValueKind = "money" | "pct" | "months" | "date" | "count";

const FIELD_KIND: Record<LoanField, ValueKind> = {
  capitalInitial: "money",
  capitalRestant: "money",
  capitalRestantApres: "money",
  taux: "pct",
  tauxEffectif: "pct",
  dureeMois: "months",
  echeancesRestantes: "months",
  dateFin: "date",
  dateDebut: "date",
  dateProchaine: "date",
  echeance: "money",
  mensualiteHorsAssurance: "money",
  mensualiteAvecAssurance: "money",
  assurance: "money",
  interets: "money",
  capitalAmorti: "money",
};

/** Intitulés usuels (sans accents, en minuscules). Le plus long qui correspond l'emporte. */
const SYNONYMS: Array<[LoanField | "ignore", string[]]> = [
  [
    "capitalInitial",
    [
      "montant de votre pret", "montant du pret", "montant emprunte", "capital emprunte", "montant initial",
      "capital initial", "montant finance", "montant du credit", "montant accorde", "montant du financement",
      "somme empruntee", "montant total emprunte", "montant debloque", "montant total du pret", "nominal",
      "montant du pret initial", "capital de depart",
    ],
  ],
  [
    "capitalRestant",
    [
      "capital restant du", "capital restant", "restant du", "crd", "montant restant du", "encours",
      "encours du pret", "solde du pret", "solde restant du", "capital du", "reste a rembourser",
      "capital restant a rembourser", "montant restant a rembourser", "encours actuel",
    ],
  ],
  [
    "capitalRestantApres",
    [
      "capital restant du apres amortissement", "capital restant du apres echeance", "capital restant apres",
      "restant du apres", "capital restant du apres la prochaine echeance", "crd apres echeance",
    ],
  ],
  [
    "taux",
    [
      "taux", "taux nominal", "taux d interet", "taux annuel", "taux fixe", "taux du pret", "taux debiteur",
      "taux nominal annuel", "taux actuariel", "taux d interet annuel", "taux du credit", "taux debiteur fixe",
    ],
  ],
  ["tauxEffectif", ["taeg", "teg", "taux annuel effectif global", "taux effectif global"]],
  [
    "dureeMois",
    [
      "duree", "duree du pret", "duree initiale", "duree totale", "nombre d echeances", "nombre total d echeances",
      "nombre de mensualites", "duree du credit", "nombre total de mensualites", "duree d amortissement",
      "duree de remboursement",
    ],
  ],
  [
    "echeancesRestantes",
    [
      "nombre d amortissements restants", "echeances restantes", "nombre d echeances restantes",
      "mensualites restantes", "nombre de mensualites restantes", "duree restante", "nombre d echeances a venir",
      "echeances a venir", "duree residuelle", "mois restants",
    ],
  ],
  [
    "dateFin",
    [
      "date d echeance", "date de fin", "date de derniere echeance", "derniere echeance", "fin du pret",
      "date de fin du pret", "date de fin de pret", "echeance finale", "date de fin de credit",
      "fin de remboursement", "date d echeance finale", "date de fin de remboursement", "terme du pret", "fin du credit",
      "fin", "date fin", "terme",
    ],
  ],
  [
    "dateDebut",
    [
      "date de debut", "date de debut du pret", "date de deblocage", "date de mise en place",
      "date de premiere echeance", "premiere echeance", "date d octroi", "date de signature", "date de depart",
      "date d effet", "debut du pret", "date de mise a disposition", "debut de remboursement",
      "date de debut de remboursement",
    ],
  ],
  [
    "dateProchaine",
    [
      "date du prochain amortissement", "date de prochaine echeance", "prochaine echeance le",
      "date de la prochaine echeance", "prochain prelevement le", "date du prochain prelevement",
      "prochaine echeance", "prochain prelevement", "date de prelevement",
    ],
  ],
  [
    "echeance",
    [
      "montant de l amortissement", "montant de l echeance", "mensualite", "echeance mensuelle",
      "montant de la mensualite", "montant de l echeance mensuelle", "prochaine echeance",
      "montant prochaine echeance", "montant du prelevement", "prelevement mensuel", "echeance",
      "montant de la prochaine echeance", "mensualite actuelle", "votre mensualite",
    ],
  ],
  ["mensualiteHorsAssurance", ["mensualite hors assurance", "echeance hors assurance", "hors assurance"]],
  [
    "mensualiteAvecAssurance",
    [
      "mensualite assurance comprise", "mensualite avec assurance", "echeance assurance comprise",
      "mensualite y compris assurance", "echeance avec assurance", "mensualite totale",
    ],
  ],
  [
    "assurance",
    [
      "assurance", "assurance due", "cotisation assurance", "cotisation d assurance", "dont assurance",
      "montant de l assurance", "assurance emprunteur", "prime d assurance", "assurance mensuelle",
    ],
  ],
  [
    "interets",
    ["interets dus", "interets", "dont interets", "part interets", "montant des interets", "interets de l echeance"],
  ],
  ["capitalAmorti", ["capital amorti", "dont capital", "part capital", "amortissement du capital", "part en capital"]],
  [
    "ignore",
    [
      "titulaire", "titulaire du contrat", "impayes", "charges dues", "charges remboursees", "charges reportees",
      "phase en cours", "numero", "numero de pret", "numero de contrat", "reference", "iban", "co emprunteur",
      "emprunteur", "frais de dossier", "interets restants", "cout total", "cout du credit", "total des interets",
      "montant total du", "interets payes", "capital rembourse", "capital deja rembourse", "interets deja payes",
      "cout total du credit", "interets cumules", "taux d endettement", "frais", "garantie",
    ],
  ],
];

const MONTHS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];
const MONTH_RE =
  "(?:janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)";
/** Une valeur : date, mois/année, ou nombre avec unité facultative. */
const VALUE_RE = new RegExp(
  [
    String.raw`\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b`,
    String.raw`\b(?:\d{1,2}(?:er)?\s+)?${MONTH_RE}\.?\s+\d{4}\b`,
    String.raw`\b\d{1,2}[/.-]\d{4}\b`,
    String.raw`(?:[+\-−]\s?)?\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?(?:\s?(?:€|eur(?:os)?\b|%|mois\b|ans?\b))?`,
    String.raw`(?:[+\-−]\s?)?\d+(?:[.,]\d+)?(?:\s?(?:€|eur(?:os)?\b|%|mois\b|ans?\b))?`,
  ].join("|"),
  "gi",
);

export interface ParsedValue {
  raw: string;
  kind: ValueKind | "number";
  value: number; // montant, %, nombre de mois, ou mois absolu (année × 12 + mois − 1) pour une date
  day?: number;
}

export interface LoanCapture {
  fields: Partial<Record<LoanField, ParsedValue>>;
  conflicts: LoanField[];
  text: string;
}

export interface LoanTier {
  debutMois: number;
  mensualite: number;
}

export type FieldSource = "lu" | "calculé" | "déduit";

export interface LoanImport {
  nom: string;
  type: string;
  preteur: string | null;
  capitalInitial: number | null;
  taux: number | null;
  dureeMois: number | null;
  /** Mois de la 1re échéance, AAAA-MM. */
  dateDebut: string | null;
  dateFin: string | null;
  /** Mensualité actuelle hors assurance. */
  mensualite: number | null;
  assurance: number | null;
  /** Mois du relevé (AAAA-MM) : capital restant après l'échéance de ce mois. */
  refDate: string | null;
  refCapital: number | null;
  paliers: LoanTier[] | null;
  paliersExplication: string | null;
  sources: Partial<Record<"capitalInitial" | "taux" | "dureeMois" | "dateDebut" | "mensualite" | "refDate" | "refCapital", FieldSource>>;
  verifications: string[];
  avertissements: string[];
  confiance: number;
  captures: number;
}

// --- Lecture d'une capture -----------------------------------------------------

export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLabel(label: string, valueKind: ParsedValue["kind"]): LoanField | "ignore" | null {
  const normalized = ` ${normalizeLabel(label)} `;
  if (normalized.trim().length < 3) return null;
  const hits: Array<{ field: LoanField | "ignore"; length: number }> = [];
  for (const [field, synonyms] of SYNONYMS) {
    for (const synonym of synonyms) {
      if (normalized.includes(` ${synonym} `)) hits.push({ field, length: synonym.length });
    }
  }
  hits.sort((a, b) => b.length - a.length);
  for (const hit of hits) {
    if (hit.field === "ignore") return "ignore";
    if (valueFits(FIELD_KIND[hit.field], valueKind)) return hit.field;
  }
  return null;
}

function valueFits(expected: ValueKind, actual: ParsedValue["kind"]): boolean {
  if (expected === actual) return true;
  if (actual === "number") return expected !== "date";
  if (expected === "months" && actual === "count") return true;
  return false;
}

function parseValue(raw: string): ParsedValue | null {
  const text = raw.replace(/[  ]/g, " ").trim();
  let match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (match) {
    const year = Number(match[3]!.length === 2 ? `20${match[3]}` : match[3]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return { raw, kind: "date", value: year * 12 + month - 1, day: Number(match[1]) };
  }
  match = /^(\d{1,2})[/.-](\d{4})$/.exec(text);
  if (match) {
    const month = Number(match[1]);
    if (month < 1 || month > 12) return null;
    return { raw, kind: "date", value: Number(match[2]) * 12 + month - 1 };
  }
  match = new RegExp(`^(?:(\\d{1,2})(?:er)?\\s+)?(${MONTH_RE})\\.?\\s+(\\d{4})$`, "i").exec(text);
  if (match) {
    const name = normalizeLabel(match[2]!).slice(0, 4);
    const month = MONTHS.findIndex((candidate) => name.startsWith(candidate.slice(0, Math.min(4, name.length))));
    if (month < 0) return null;
    return { raw, kind: "date", value: Number(match[3]) * 12 + month, ...(match[1] ? { day: Number(match[1]) } : {}) };
  }
  match = /^([+\-−]?)\s?([\d  ]+(?:[.,]\d+)?)\s?(€|eur(?:os)?|%|mois|ans?)?$/i.exec(text);
  if (!match) return null;
  const digits = match[2]!.replace(/\s/g, "").replace(",", ".");
  let value = Number(digits);
  if (!Number.isFinite(value)) return null;
  if (match[1] && match[1] !== "+") value = -value;
  const unit = (match[3] ?? "").toLowerCase();
  if (unit === "€" || unit.startsWith("eur")) return { raw, kind: "money", value };
  if (unit === "%") return { raw, kind: "pct", value };
  if (unit === "mois") return { raw, kind: "months", value };
  if (unit === "an" || unit === "ans") return { raw, kind: "months", value: value * 12 };
  if (/^\d+$/.test(digits)) return { raw, kind: "count", value };
  return { raw, kind: "number", value };
}

interface Segment {
  label: string;
  values: string[];
}

/** Une ligne découpée en « intitulé valeur intitulé valeur… ». */
function splitLine(line: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  VALUE_RE.lastIndex = 0;
  for (let match = VALUE_RE.exec(line); match; match = VALUE_RE.exec(line)) {
    // Un chiffre collé à des lettres fait partie de l'intitulé (« 3UU », « T2 »).
    const prev = line[match.index - 1] ?? " ";
    const next = line[match.index + match[0].length] ?? " ";
    if (/[A-Za-zÀ-ÿ]/.test(prev) || (/[A-Za-zÀ-ÿ]/.test(next) && !/(?:€|%|mois|ans?)$/i.test(match[0]))) continue;
    const before = line.slice(cursor, match.index);
    const value = match[0].trim();
    if (/[A-Za-zÀ-ÿ]{2,}/.test(before)) segments.push({ label: before.trim(), values: [value] });
    else if (segments.length) segments[segments.length - 1]!.values.push(value);
    else segments.push({ label: "", values: [value] });
    cursor = match.index + match[0].length;
  }
  const tail = line.slice(cursor).trim();
  if (/[A-Za-zÀ-ÿ]{2,}/.test(tail)) segments.push({ label: tail, values: [] });
  else if (/^(€|eur|%)$/i.test(tail) && segments.length) {
    const last = segments[segments.length - 1]!;
    if (last.values.length) last.values[last.values.length - 1] += ` ${tail}`;
  }
  return segments;
}

function isValueOnly(line: string): boolean {
  const stripped = line.replace(VALUE_RE, " ").replace(/[€%\s.,:]/g, "").replace(/^(eur|euros|mois|ans?)$/i, "");
  return /\d|€/.test(line) && !/[A-Za-zÀ-ÿ]{2,}/.test(stripped);
}

function hasUnit(value: string): boolean {
  return /€|eur|%|mois|ans?$|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d[/.-]\d{4}/i.test(value);
}

/** Lit une capture : couples intitulé → valeur, quelle que soit la mise en page. */
export function parseLoanCapture(text: string): LoanCapture {
  const lines = text
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    // Barre d'état du téléphone (« 15:37 … »).
    .filter((line, index) => !(index < 2 && /^\d{1,2}[:h]\d{2}\b/.test(line)));
  // Intitulé seul sur sa ligne : valeur en dessous (cas le plus courant) ou au-dessus.
  // On lit des deux façons et on garde celle où les valeurs correspondent à leurs intitulés.
  const below = readLines(lines, "below");
  const above = readLines(lines, "above");
  const best = above.assigned > below.assigned ? above : below;
  return { fields: best.fields, conflicts: best.conflicts, text };
}

function readLines(lines: string[], layout: "below" | "above") {
  const fields: LoanCapture["fields"] = {};
  const conflicts: LoanField[] = [];
  let assigned = 0;
  let orphanValue: string | null = null;

  const assign = (label: string, rawValue: string) => {
    const parsed = parseValue(rawValue);
    if (!parsed) return;
    const field = resolveLabel(label, parsed.kind);
    if (!field || field === "ignore") return;
    const value: ParsedValue = { ...parsed, kind: FIELD_KIND[field] === "date" ? "date" : parsed.kind };
    const existing = fields[field];
    if (existing) {
      if (Math.abs(existing.value - value.value) > 0.011 && !conflicts.includes(field)) conflicts.push(field);
      return;
    }
    fields[field] = value;
    assigned++;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isValueOnly(line)) {
      orphanValue = orphanValue && !hasUnit(orphanValue) ? `${orphanValue} ${line}` : line;
      continue;
    }
    const segments = splitLine(line);
    segments.forEach((segment, s) => {
      if (!segment.label) return;
      const last = s === segments.length - 1;
      if (segment.values.length) {
        let value = segment.values.join(" ");
        // Valeur coupée sur plusieurs lignes (« 87 » / « 929,08 » / « € »).
        while (last && !hasUnit(value) && i + 1 < lines.length && isValueOnly(lines[i + 1]!)) {
          value = `${value} ${lines[++i]!}`;
        }
        assign(segment.label, value);
        orphanValue = null;
        return;
      }
      if (!last) return;
      if (layout === "above") {
        if (orphanValue) assign(segment.label, orphanValue);
        orphanValue = null;
        return;
      }
      orphanValue = null;
      if (i + 1 < lines.length && isValueOnly(lines[i + 1]!)) {
        let value = lines[++i]!;
        while (!hasUnit(value) && i + 1 < lines.length && isValueOnly(lines[i + 1]!)) value = `${value} ${lines[++i]!}`;
        assign(segment.label, value);
      }
    });
  }
  return { fields, conflicts, assigned };
}

// --- Fusion des captures ---------------------------------------------------------

const IDENTIFYING: LoanField[] = [
  "capitalInitial",
  "capitalRestant",
  "capitalRestantApres",
  "echeancesRestantes",
  "echeance",
  "interets",
  "capitalAmorti",
  "taux",
];

function compatibility(a: LoanCapture["fields"], b: LoanCapture["fields"]): number {
  let shared = 0;
  for (const key of Object.keys(a) as LoanField[]) {
    const left = a[key];
    const right = b[key];
    if (!left || !right) continue;
    if (Math.abs(left.value - right.value) > 0.011) return -1;
    if (IDENTIFYING.includes(key)) shared++;
  }
  // Recoupement : capital restant − capital amorti = capital restant après l'échéance.
  const crd = a.capitalRestant ?? b.capitalRestant;
  const amorti = a.capitalAmorti ?? b.capitalAmorti;
  const after = a.capitalRestantApres ?? b.capitalRestantApres;
  if (crd && amorti && after) {
    if (Math.abs(crd.value - amorti.value - after.value) > 0.05) return -1;
    const split = (a.capitalRestant && !a.capitalRestantApres) || (b.capitalRestant && !b.capitalRestantApres);
    if (split) shared++;
  }
  return shared;
}

/** Regroupe les captures par crédit : celles qui se recoupent sans contradiction vont ensemble. */
export function groupLoanCaptures(captures: LoanCapture[]): LoanCapture[][] {
  const usable = captures.filter((capture) => Object.keys(capture.fields).length > 0);
  const groups: Array<{ fields: LoanCapture["fields"]; members: LoanCapture[] }> = [];
  // Les captures les plus riches d'abord, pour que les morceaux se rattachent à elles.
  const ordered = [...usable].sort((a, b) => Object.keys(b.fields).length - Object.keys(a.fields).length);
  for (const capture of ordered) {
    let best: { group: (typeof groups)[number]; score: number } | null = null;
    for (const group of groups) {
      const score = compatibility(group.fields, capture.fields);
      if (score > 0 && (!best || score > best.score)) best = { group, score };
    }
    if (best) {
      best.group.members.push(capture);
      best.group.fields = { ...capture.fields, ...best.group.fields };
    } else {
      groups.push({ fields: { ...capture.fields }, members: [capture] });
    }
  }
  // Ordre d'origine des captures.
  return groups
    .map((group) => group.members.sort((a, b) => captures.indexOf(a) - captures.indexOf(b)))
    .sort((a, b) => captures.indexOf(a[0]!) - captures.indexOf(b[0]!));
}

// --- Mathématiques du crédit ------------------------------------------------------

export function annuity(capital: number, annualRate: number, months: number): number {
  if (months <= 0) return capital;
  const r = annualRate / 100 / 12;
  if (!r) return capital / months;
  return (capital * r) / (1 - Math.pow(1 + r, -months));
}

/** Capital restant après `months` échéances constantes. */
function balanceAfter(capital: number, annualRate: number, payment: number, months: number): number {
  const r = annualRate / 100 / 12;
  let balance = capital;
  for (let i = 0; i < months && balance > 0; i++) balance = balance * (1 + r) - payment;
  return Math.max(0, balance);
}

const ceilCents = (value: number) => Math.ceil(value * 100 - 1e-6) / 100;
const roundCents = (value: number) => Math.round(value * 100) / 100;

function monthKey(absolute: number): string {
  return `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
}

function monthLabel(absolute: number): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Math.floor(absolute / 12), absolute % 12, 1)),
  );
}

function euros(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
}

type Profile = "constant" | "baisse" | "hausse" | "differe" | "inconnu";

interface Draft extends LoanImport {
  absDebut: number | null;
  absFin: number | null;
  absRef: number | null;
  profile: Profile;
}

const PRETEURS: Array<[RegExp, string]> = [
  [/bourso/i, "BoursoBank"],
  [/cr[ée]dit agricole/i, "Crédit Agricole"],
  [/\blcl\b/i, "LCL"],
  [/bnp/i, "BNP Paribas"],
  [/soci[ée]t[ée] g[ée]n[ée]rale/i, "Société Générale"],
  [/cr[ée]dit mutuel/i, "Crédit Mutuel"],
  [/\bcic\b/i, "CIC"],
  [/caisse d.[ée]pargne/i, "Caisse d'Épargne"],
  [/banque populaire/i, "Banque Populaire"],
  [/banque postale/i, "La Banque Postale"],
  [/fortuneo/i, "Fortuneo"],
  [/hello ?bank/i, "Hello bank!"],
  [/\bing\b/i, "ING"],
  [/monabanq/i, "Monabanq"],
  [/action logement/i, "Action Logement"],
  [/cetelem/i, "Cetelem"],
  [/cofidis/i, "Cofidis"],
  [/sofinco/i, "Sofinco"],
  [/franfinance/i, "Franfinance"],
];

function loanType(text: string, taux: number | null): string {
  const normalized = normalizeLabel(text);
  if (/\b(ptz|pret a taux zero|taux zero)\b/.test(normalized)) return "Prêt à taux zéro";
  if (/\baction logement\b|\b1 logement\b/.test(normalized)) return "Prêt Action Logement";
  if (/\b(pel|pret epargne logement)\b/.test(normalized)) return "Prêt épargne logement";
  if (/\b(immobilier|habitat|residence principale|acquisition)\b/.test(normalized)) return "Prêt immobilier";
  if (/\b(auto|automobile|vehicule|loa)\b/.test(normalized)) return "Crédit auto";
  if (/\b(personnel|consommation|conso|renouvelable)\b/.test(normalized)) return "Prêt personnel";
  if (/\b(travaux)\b/.test(normalized)) return "Prêt travaux";
  if (taux === 0) return "Prêt à 0 %";
  return "Prêt";
}

function reconcile(group: LoanCapture[], now: Date): Draft {
  const fields: LoanCapture["fields"] = {};
  const conflicts = new Set<LoanField>();
  for (const capture of group) {
    for (const [key, value] of Object.entries(capture.fields) as Array<[LoanField, ParsedValue]>) {
      if (!fields[key]) fields[key] = value;
      else if (Math.abs(fields[key]!.value - value.value) > 0.011) conflicts.add(key);
    }
    capture.conflicts.forEach((key) => conflicts.add(key));
  }
  const text = group.map((capture) => capture.text).join("\n");
  const get = (key: LoanField) => fields[key]?.value ?? null;
  const sources: LoanImport["sources"] = {};
  const verifications: string[] = [];
  const avertissements: string[] = [];
  let confiance = 0.45;

  for (const key of conflicts) avertissements.push(`Deux valeurs différentes lues pour « ${key} » : vérifie ce champ.`);

  const capitalInitial = get("capitalInitial");
  if (capitalInitial !== null) sources.capitalInitial = "lu";

  let taux = get("taux");
  if (taux !== null) sources.taux = "lu";
  else if (get("tauxEffectif") !== null) {
    taux = get("tauxEffectif");
    sources.taux = "lu";
    avertissements.push("Seul le TAEG est visible : il inclut assurance et frais. Remplace-le par le taux nominal si tu l'as.");
  }

  // Durée et dates : chacune se déduit des deux autres.
  let duree = get("dureeMois");
  let absFin = get("dateFin");
  let absDebut = get("dateDebut");
  if (duree !== null) sources.dureeMois = "lu";
  if (absDebut !== null) sources.dateDebut = "lu";
  const restants = get("echeancesRestantes");
  const prochaine = get("dateProchaine");
  if (absFin === null && prochaine !== null && restants !== null && restants > 0) absFin = prochaine + restants - 1;
  if (absDebut === null && absFin !== null && duree !== null) {
    absDebut = absFin - (duree - 1);
    sources.dateDebut = "calculé";
  }
  if (absFin === null && absDebut !== null && duree !== null) absFin = absDebut + duree - 1;
  if (duree === null && absDebut !== null && absFin !== null && absFin >= absDebut) {
    duree = absFin - absDebut + 1;
    sources.dureeMois = "calculé";
  }
  if (get("dureeMois") !== null && get("dateDebut") !== null && get("dateFin") !== null) {
    if (get("dateFin")! - get("dateDebut")! + 1 !== duree) {
      avertissements.push("Durée, date de début et date de fin ne concordent pas : vérifie la date de 1re échéance.");
    }
  }

  // Mensualité actuelle hors assurance.
  const assurance = get("assurance");
  let mensualite: number | null = null;
  if (get("mensualiteHorsAssurance") !== null) mensualite = get("mensualiteHorsAssurance");
  else if (get("echeance") !== null) mensualite = get("echeance")! - (assurance ?? 0);
  else if (get("mensualiteAvecAssurance") !== null) mensualite = get("mensualiteAvecAssurance")! - (assurance ?? 0);
  else if (get("capitalAmorti") !== null && get("interets") !== null) mensualite = get("capitalAmorti")! + get("interets")!;
  if (mensualite !== null) {
    mensualite = roundCents(Math.max(0, mensualite));
    sources.mensualite = get("mensualiteHorsAssurance") !== null || (get("echeance") !== null && !assurance) ? "lu" : "calculé";
  }
  if (get("echeance") !== null && get("capitalAmorti") !== null && get("interets") !== null) {
    const parts = get("capitalAmorti")! + get("interets")! + (assurance ?? 0);
    if (Math.abs(parts - get("echeance")!) <= 0.05) {
      verifications.push("Échéance = capital amorti + intérêts + assurance.");
      confiance += 0.05;
    } else {
      avertissements.push("L'échéance ne correspond pas à capital + intérêts + assurance : vérifie la mensualité.");
    }
  }

  // Capital restant et date du relevé.
  let refCapital = get("capitalRestant");
  let absRef: number | null = null;
  const nowAbs = now.getFullYear() * 12 + now.getMonth();
  const paymentDay = fields.dateProchaine?.day ?? fields.dateFin?.day ?? fields.dateDebut?.day ?? 5;
  const currentRef = now.getDate() >= paymentDay ? nowAbs : nowAbs - 1;
  if (refCapital !== null) {
    sources.refCapital = "lu";
    if (prochaine !== null && prochaine > currentRef - 1 && prochaine <= currentRef + 2 && (absDebut === null || prochaine > absDebut)) {
      absRef = prochaine - 1;
      sources.refDate = "calculé";
    } else {
      absRef = currentRef;
      sources.refDate = "déduit";
    }
  } else if (get("capitalRestantApres") !== null && prochaine !== null) {
    refCapital = get("capitalRestantApres");
    absRef = prochaine;
    sources.refCapital = "lu";
    sources.refDate = "calculé";
  }
  if (refCapital !== null && get("capitalRestantApres") !== null && get("capitalAmorti") !== null && get("capitalRestant") !== null) {
    if (Math.abs(refCapital - get("capitalAmorti")! - get("capitalRestantApres")!) <= 0.05) {
      verifications.push("Capital restant − capital amorti = capital restant après l'échéance.");
      confiance += 0.05;
    }
  }
  if (refCapital !== null && taux !== null && get("interets") !== null && get("interets")! > 0) {
    const expected = (refCapital * taux) / 1200;
    if (Math.abs(expected - get("interets")!) <= Math.max(0.05, expected * 0.005)) {
      verifications.push(`Intérêts du mois = capital restant × ${taux.toLocaleString("fr-FR")} % / 12.`);
      confiance += 0.15;
    } else {
      avertissements.push("Les intérêts du mois ne collent pas avec le taux et le capital restant : vérifie le taux.");
      confiance -= 0.1;
    }
  }
  if (refCapital !== null && capitalInitial !== null && refCapital > capitalInitial + 0.01) {
    avertissements.push("Le capital restant dépasse le montant emprunté : vérifie ces deux montants.");
    confiance -= 0.2;
  }

  // Profil des remboursements à venir.
  let profile: Profile = "inconnu";
  const paid = absDebut !== null && absRef !== null ? absRef - absDebut + 1 : null;
  const remaining = duree !== null && paid !== null ? duree - paid : null;
  if (restants !== null && remaining !== null && mensualite && Math.abs(restants - remaining) <= 1) {
    verifications.push(`${restants} échéances restantes, cohérent avec la date de fin.`);
    confiance += 0.05;
  }
  if (refCapital !== null && refCapital > 0 && mensualite === 0) profile = "differe";
  else if (refCapital !== null && taux !== null && mensualite && remaining !== null && remaining > 0) {
    const theoretical = annuity(refCapital, taux, remaining);
    const gap = mensualite - theoretical;
    if (Math.abs(gap) <= Math.max(1, theoretical * 0.005)) {
      profile = "constant";
      verifications.push("Mensualité constante jusqu'au terme : le tableau d'amortissement retombe à zéro à la date de fin.");
      confiance += 0.1;
    } else profile = gap > 0 ? "baisse" : "hausse";
  }

  // Fiche complète : de quoi calculer tout le tableau d'amortissement.
  if (capitalInitial !== null && taux !== null && duree !== null && absDebut !== null && refCapital !== null) confiance += 0.1;
  if (absDebut === null) avertissements.push("Date de 1re échéance introuvable : renseigne-la pour le calcul automatique.");
  if (capitalInitial === null) avertissements.push("Montant emprunté introuvable : ajoute la capture du haut de la fiche du crédit.");
  if (taux === null) avertissements.push("Taux introuvable.");

  const type = loanType(text, taux);
  const preteur = PRETEURS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  const nom = capitalInitial !== null ? `${type} ${new Intl.NumberFormat("fr-FR").format(capitalInitial)} €` : type;

  return {
    nom,
    type,
    preteur,
    capitalInitial,
    taux,
    dureeMois: duree,
    dateDebut: absDebut !== null ? monthKey(absDebut) : null,
    dateFin: absFin !== null ? monthKey(absFin) : null,
    mensualite,
    assurance,
    refDate: absRef !== null ? monthKey(absRef) : null,
    refCapital,
    paliers: null,
    paliersExplication: null,
    sources,
    verifications,
    avertissements,
    confiance,
    captures: group.length,
    absDebut,
    absFin,
    absRef,
    profile,
  };
}

/**
 * Lissage : un prêt dont la mensualité baisse plus tard, et un prêt en différé (souvent un PTZ)
 * qui démarre au même moment, la somme des deux restant à peu près constante.
 * On cherche le mois de bascule qui rend la somme constante.
 */
function inferSmoothing(main: Draft, deferred: Draft): boolean {
  if (
    main.absDebut === null || main.absFin === null || main.absRef === null || main.refCapital === null ||
    main.taux === null || !main.mensualite || deferred.absDebut === null || deferred.absFin === null ||
    deferred.taux === null
  ) {
    return false;
  }
  const deferredCapital = deferred.refCapital ?? deferred.capitalInitial;
  if (!deferredCapital) return false;
  const start = Math.max(main.absRef, deferred.absRef ?? main.absRef) + 1;
  const end = Math.min(main.absFin, deferred.absFin);
  let best: { month: number; after: number; deferredPayment: number; gap: number } | null = null;
  for (let month = start; month <= end; month++) {
    const balance = balanceAfter(main.refCapital, main.taux, main.mensualite, month - 1 - main.absRef);
    const after = annuity(balance, main.taux, main.absFin - month + 1);
    const deferredPayment = annuity(deferredCapital, deferred.taux, deferred.absFin - month + 1);
    const gap = Math.abs(after + deferredPayment - main.mensualite);
    if (!best || gap < best.gap) best = { month, after, deferredPayment, gap };
  }
  if (!best || best.gap > Math.max(1.5, main.mensualite * 0.003)) return false;

  const mainNext = ceilCents(best.after);
  const deferredNext = ceilCents(best.deferredPayment);
  main.paliers = [
    { debutMois: 1, mensualite: main.mensualite },
    { debutMois: best.month - main.absDebut + 1, mensualite: mainNext },
  ];
  deferred.paliers = [
    { debutMois: 1, mensualite: 0 },
    { debutMois: best.month - deferred.absDebut + 1, mensualite: deferredNext },
  ];
  const when = monthLabel(best.month);
  main.paliersExplication = `Lissage avec « ${deferred.nom} » : ${euros(main.mensualite)} jusqu'à ${monthLabel(best.month - 1)}, puis ${euros(mainNext)} à partir de ${when}, quand l'autre prêt démarre (${euros(deferredNext)}). Total quasi constant.`;
  deferred.paliersExplication = `Différé jusqu'à ${monthLabel(best.month - 1)}, puis ${euros(deferredNext)} par mois à partir de ${when} (lissage avec « ${main.nom} »).`;
  main.sources.mensualite = main.sources.mensualite ?? "lu";
  for (const loan of [main, deferred]) {
    loan.confiance += 0.1;
    loan.verifications.push("Paliers déduits du lissage entre les deux prêts : vérifie-les sur ton tableau d'amortissement.");
  }
  return true;
}

export interface LoanImportResult {
  prets: LoanImport[];
  avertissements: string[];
}

/** Analyse un lot de captures (une capture = un texte) et renvoie un crédit par prêt reconnu. */
export function parseLoanCaptures(texts: string[], now: Date = new Date()): LoanImportResult {
  const captures = texts.map(parseLoanCapture);
  const ignored = captures.filter((capture) => Object.keys(capture.fields).length === 0).length;
  const drafts = groupLoanCaptures(captures).map((group) => reconcile(group, now));

  const decreasing = drafts.filter((draft) => draft.profile === "baisse");
  const deferred = drafts.filter((draft) => draft.profile === "differe");
  const paired = new Set<Draft>();
  for (const main of decreasing) {
    for (const other of deferred) {
      if (paired.has(other)) continue;
      if (inferSmoothing(main, other)) {
        paired.add(main);
        paired.add(other);
        break;
      }
    }
  }
  for (const draft of drafts) {
    if (paired.has(draft)) continue;
    if (draft.profile === "baisse") {
      draft.avertissements.push(
        `La mensualité actuelle (${euros(draft.mensualite!)}) solderait ce prêt avant sa date de fin : elle baissera plus tard (paliers, souvent un lissage avec un PTZ). Importe aussi la capture de l'autre prêt, ou ajoute les paliers ensuite.`,
      );
    } else if (draft.profile === "hausse") {
      draft.avertissements.push(
        `La mensualité actuelle (${euros(draft.mensualite!)}) ne suffit pas à solder ce prêt à la date de fin : elle augmentera plus tard (paliers). Ajoute-les ensuite pour un calcul exact.`,
      );
    } else if (draft.profile === "differe") {
      draft.avertissements.push(
        "Aucun remboursement en cours (différé) : le capital restera constant tant que tu n'ajoutes pas le palier de début des remboursements.",
      );
    }
  }

  const prets: LoanImport[] = drafts.map((draft) => {
    const loan: LoanImport & Partial<Pick<Draft, "absDebut" | "absFin" | "absRef" | "profile">> = { ...draft };
    delete loan.absDebut;
    delete loan.absFin;
    delete loan.absRef;
    delete loan.profile;
    return { ...loan, confiance: Math.max(0.1, Math.min(0.98, loan.confiance)) };
  });
  const avertissements: string[] = [];
  if (!prets.length) avertissements.push("Aucun crédit reconnu. Vérifie que la capture montre la fiche du crédit (montant, taux, durée…).");
  if (ignored && prets.length) avertissements.push(`${ignored} capture(s) sans information de crédit ignorée(s).`);
  return { prets, avertissements };
}

// --- Rapprochement et application ------------------------------------------------

export function matchLoan(loan: Pick<LoanImport, "capitalInitial" | "refCapital" | "taux" | "nom">, assets: Asset[]): Asset | null {
  const credits = assets.filter((asset) => asset.type === "credit");
  if (loan.capitalInitial !== null) {
    const same = credits.filter((asset) => Math.abs(Number(asset.data["capitalInitial"]) - loan.capitalInitial!) <= 1);
    if (same.length === 1) return same[0]!;
  }
  if (loan.refCapital !== null) {
    let best: { asset: Asset; gap: number } | null = null;
    for (const asset of credits) {
      const current = remainingCapital(asset.data);
      if (!current) continue;
      const gap = Math.abs(current - loan.refCapital) / current;
      const sameRate = loan.taux === null || asset.data["taux"] === undefined || Math.abs(Number(asset.data["taux"]) - loan.taux) < 0.01;
      if (gap <= 0.03 && sameRate && (!best || gap < best.gap)) best = { asset, gap };
    }
    if (best) return best.asset;
  }
  return null;
}

export interface LoanDecision {
  action: "update" | "create" | "ignore";
  assetId?: string;
  bienId?: string;
  appliquerPaliers: boolean;
  pret: LoanImport;
}

export function applyLoanDecisions(
  assets: Asset[],
  decisions: LoanDecision[],
  stamp: string,
  createId: () => string,
): Asset[] {
  const next = [...assets];
  for (const decision of decisions) {
    if (decision.action === "ignore") continue;
    const index = decision.assetId ? next.findIndex((asset) => asset.id === decision.assetId) : -1;
    const existing = index >= 0 ? next[index] : undefined;
    if (decision.action === "update" && (!existing || existing.type !== "credit")) continue;
    const loan = decision.pret;
    const data: Asset["data"] = { ...(existing?.data ?? {}), lastImportAt: stamp };
    const put = (key: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && value !== "") data[key] = value;
    };
    if (!existing || !data["name"]) put("name", loan.nom.trim());
    if (!existing || !data["type"]) put("type", loan.type);
    put("preteur", loan.preteur);
    put("capitalInitial", loan.capitalInitial);
    put("taux", loan.taux);
    put("dureeMois", loan.dureeMois);
    put("dateDebut", loan.dateDebut);
    put("mensualite", loan.mensualite);
    put("refDate", loan.refDate);
    put("refCapital", loan.refCapital);
    put("capitalRestant", loan.refCapital);
    if (loan.dateFin) put("dateFin", `${loan.dateFin.slice(5, 7)}/${loan.dateFin.slice(0, 4)}`);
    if (decision.bienId) put("bienId", decision.bienId);
    if (decision.appliquerPaliers && loan.paliers?.length) data["paliers"] = JSON.stringify(loan.paliers);
    const updated: Asset = {
      id: existing?.id ?? createId(),
      type: "credit",
      data,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    };
    if (existing) next[index] = updated;
    else next.push(updated);
  }
  return next;
}
