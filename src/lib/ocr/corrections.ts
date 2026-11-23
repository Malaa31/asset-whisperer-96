/**
 * Corrections des confusions OCR courantes, appliquées au texte de chaque boîte avant la lecture.
 * Chaque règle est étroite (contexte numérique) pour ne pas abîmer les noms de titres.
 */

const LABELS = "Qt[ée]s?|Quantit[ée]|Prix|PRU|P\\/L|Cours|Valo|Valorisation|Montant";

export function correctOcrText(text: string): string {
  return (
    text
      .replace(/[\u00a0\u202f\u2009]/g, " ")
      // « € » lu « ∈ », ou « e / E / C » juste après un montant à deux décimales.
      .replace(/∈/g, "€")
      .replace(/(\d[.,]\d{2})\s?[eEC](?![A-Za-zÀ-ÿ])/g, "$1 €")
      // Devise collée au montant : « 5431,68EUR » → « 5431,68 EUR ».
      .replace(/(\d)(EUR|€)\b/g, "$1 $2")
      .replace(/(\d)€/g, "$1 €")
      // Intitulé collé à sa valeur : « Qté736 », « Prix7,38 », « P/L-228,16 ».
      .replace(new RegExp(`(?<![A-Za-zÀ-ÿ])(${LABELS})(?=[+\\-−]?\\d)`, "gi"), "$1 ")
      // Flèche de plus-value lue comme un symbole collé au montant (« π2038,81 € », « 刁134,43 € »).
      .replace(/[π刁√↗↘⬈⬊]\s?(?=[+\-−]?\d)/g, "")
      // Triangles de variation (« ▲ 59,75 % ») : signe devant un nombre, sinon supprimés.
      .replace(/\s?[▲▼△▽]\s?/g, " ")
      // « PRU € / quantité » dont la barre est lue « 1 » : « 21,46€1152 » → « 21,46 € / 152 ».
      .replace(/^(\d[\d ]*[.,]\d{2}) ?€1(\d{1,6})$/, "$1 € / $2")
      // « +-val. » → « +/- val. »
      .replace(/\+\s?-(?=\s?[A-Za-z])/g, "+/- ")
  );
}
