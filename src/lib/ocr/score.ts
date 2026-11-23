import type { ExpectedCapture } from "./expected";
import type { PipelineResult } from "./pipeline";

/**
 * Notation d'une capture : chaque champ affiché à l'écran vaut un point.
 * - nom : validé si la ligne lue se rattache au bon ISIN ;
 * - quantité : exacte ; PRU, valorisation, total : à ±0,01 € ;
 * - une ligne importée en trop compte comme un champ faux (elle fausserait l'import).
 */

export type ScoredField =
  "nom" | "quantite" | "pru" | "valorisation" | "total" | "libelle" | "ligne-en-trop";

export interface FieldScore {
  field: ScoredField;
  ok: boolean;
  expected: unknown;
  got: unknown;
  position: string | null;
}

const near = (a: number | null | undefined, b: number, tolerance = 0.01) =>
  a != null && Math.abs(a - b) <= tolerance + 1e-6;
const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function scoreCapture(expected: ExpectedCapture, got: PipelineResult): FieldScore[] {
  const scores: FieldScore[] = [];
  if (expected.kind === "livret") {
    if (expected.libelle !== null) {
      scores.push({
        field: "libelle",
        ok: normalize(got.libelle) === normalize(expected.libelle),
        expected: expected.libelle,
        got: got.libelle,
        position: null,
      });
    }
  }
  const predictions = [...got.positions];
  const used = new Set<number>();
  const take = (predicate: (index: number) => boolean) => {
    const index = predictions.findIndex((_, i) => !used.has(i) && predicate(i));
    if (index >= 0) used.add(index);
    return index >= 0 ? predictions[index]! : null;
  };
  for (const position of expected.positions) {
    const match =
      take((i) => Boolean(position.isin) && predictions[i]!.isin === position.isin) ??
      take(
        (i) =>
          position.valorisation !== null &&
          near(predictions[i]!.valorisation, position.valorisation),
      ) ??
      take((i) => position.quantite !== null && predictions[i]!.quantite === position.quantite);
    const label = position.nom;
    scores.push({
      field: "nom",
      ok: position.isin
        ? match?.isin === position.isin
        : normalize(match?.nom) === normalize(position.nom),
      expected: position.isin ?? position.nom,
      got: match ? `${match.isin ?? "?"} ${match.nom}` : null,
      position: label,
    });
    if (position.quantite !== null) {
      scores.push({
        field: "quantite",
        ok: match?.quantite != null && Math.abs(match.quantite - position.quantite) < 1e-9,
        expected: position.quantite,
        got: match?.quantite ?? null,
        position: label,
      });
    }
    if (position.pru !== null)
      scores.push({
        field: "pru",
        ok: near(match?.pru, position.pru),
        expected: position.pru,
        got: match?.pru ?? null,
        position: label,
      });
    if (position.valorisation !== null) {
      scores.push({
        field: "valorisation",
        ok: near(match?.valorisation, position.valorisation),
        expected: position.valorisation,
        got: match?.valorisation ?? null,
        position: label,
      });
    }
  }
  predictions.forEach((prediction, index) => {
    if (!used.has(index))
      scores.push({
        field: "ligne-en-trop",
        ok: false,
        expected: null,
        got: `${prediction.nom} (${prediction.valorisation ?? "?"} €)`,
        position: prediction.nom,
      });
  });
  if (expected.total !== null)
    scores.push({
      field: "total",
      ok: near(got.total, expected.total),
      expected: expected.total,
      got: got.total,
      position: null,
    });
  return scores;
}

export interface Tally {
  ok: number;
  total: number;
}

export const ratio = (tally: Tally) => (tally.total ? tally.ok / tally.total : 1);

export function tally(scores: FieldScore[]): Tally {
  return { ok: scores.filter((score) => score.ok).length, total: scores.length };
}
