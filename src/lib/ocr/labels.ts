import type { Row } from "./layout";

/**
 * Lecture des intitulés de champs, quelle que soit leur disposition :
 * - en grille : une ligne d'intitulés (« Quantité   PRU ») puis la ligne de leurs valeurs,
 *   colonne par colonne (Fortuneo) ;
 * - en ligne : plusieurs couples « intitulé valeur » sur une même ligne (« Qté 736 Prix 7,38 P/L … », Degiro).
 * Chaque couple est réécrit sur sa propre ligne « intitulé valeur », que l'analyseur sait lire.
 */

const LABEL_WORD =
  /^(?:qt[ée]s?\.?|quantit[ée]s?|pru|px\.? ?(?:de )?revient|prix de revient|prix moyen|cours|dernier cours|prix|valorisation|valo\.?|montant|valeur|\+\/-\s?values?(?: latentes?)?)$/i;
const NUMBER = String.raw`[+\-−]?(?:\d{1,3}(?: \d{3})+|\d+)(?:[.,]\d+)?(?:\s?(?:€|EUR|%))?`;
const INLINE = new RegExp(
  String.raw`(Qt[ée]s?\.?|Quantit[ée]s?|PRU|Prix(?! de revient)|Cours|Valo(?:risation)?\.?|P\/L|Montant)\s*:?\s*(${NUMBER})`,
  "gi",
);
const VARIATION = /^(?:p\/l|\+\/-)/i;

const isNumberText = (text: string) => new RegExp(`^${NUMBER}$`).test(text.trim());

export function rewriteLabeledRows(rows: Row[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const next = rows[i + 1];
    // Grille : intitulés seuls, puis valeurs alignées en dessous.
    const labels = row.boxes.filter((box) => LABEL_WORD.test(box.text.trim()));
    if (labels.length >= 2 && labels.length === row.boxes.length && next) {
      const values = next.boxes.filter((box) => isNumberText(box.text));
      if (values.length >= labels.length && values.length === next.boxes.length) {
        for (const label of labels) {
          const center = label.x + label.width / 2;
          const value = values.reduce((best, box) =>
            Math.abs(box.x + box.width / 2 - center) < Math.abs(best.x + best.width / 2 - center)
              ? box
              : best,
          );
          if (!VARIATION.test(label.text.trim()))
            lines.push(`${label.text.trim()} ${value.text.trim()}`);
        }
        i++;
        continue;
      }
    }
    // En ligne : au moins deux couples « intitulé valeur ».
    const pairs = [...row.text.matchAll(INLINE)];
    if (pairs.length >= 2) {
      const before = row.text.slice(0, pairs[0]!.index).trim();
      if (/[A-Za-zÀ-ÿ]{2,}/.test(before)) lines.push(before);
      for (const pair of pairs)
        if (!VARIATION.test(pair[1]!)) lines.push(`${pair[1]} ${pair[2]!.trim()}`);
      continue;
    }
    lines.push(row.text);
  }
  return lines;
}
