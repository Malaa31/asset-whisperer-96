/**
 * Format de la « réponse attendue » d'une capture, commun au corpus synthétique,
 * aux vraies captures (fixtures/real) et à la sortie du pipeline.
 * Un champ à `null` n'est pas affiché à l'écran : il n'est pas noté.
 */

export type CaptureSource =
  | "boursorama"
  | "trade-republic"
  | "fortuneo"
  | "bourse-direct"
  | "degiro"
  | "credit-agricole"
  | "autre";

export const SOURCES: CaptureSource[] = [
  "boursorama",
  "trade-republic",
  "fortuneo",
  "bourse-direct",
  "degiro",
  "credit-agricole",
];

export interface ExpectedPosition {
  nom: string;
  /** ISIN du titre : le nom lu est validé s'il se rattache à cet ISIN. */
  isin: string | null;
  quantite: number | null;
  pru: number | null;
  valorisation: number | null;
}

export interface ExpectedCapture {
  version: 1;
  source: "synthetic" | "real";
  broker: CaptureSource;
  kind: "positions" | "livret";
  enveloppe: "PEA" | "CTO" | null;
  /** Libellé du compte d'épargne (« Livret A ») pour un écran de livret. */
  libelle: string | null;
  /** Total du compte affiché (valorisation du portefeuille ou solde du livret). */
  total: number | null;
  positions: ExpectedPosition[];
  notes?: string;
}

export interface FixtureEntry {
  id: string;
  broker: CaptureSource;
  image: string;
  expected: string;
  split: "dev" | "test" | "real";
}
