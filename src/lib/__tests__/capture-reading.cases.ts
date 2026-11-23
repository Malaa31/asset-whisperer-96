import { CAPTURE_MARKER, captureQuality, needsSecondPass, splitCaptureText } from "../capture-kind";
import { parseLoanCaptures } from "../loan-import";
import { ocrScale, prepareForOcr } from "../ocr-preprocess";
import { positionParserCases } from "./position-parser.cases";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log("\nPRÉPARATION DE L'IMAGE");
check("capture d'iPhone lue à sa taille native", ocrScale(1179, 2556) === 1 && ocrScale(1290, 2796) === 1);
check("petite image agrandie (au plus ×2)", ocrScale(600, 1300) === 2 && Math.abs(ocrScale(900, 1950) - 1600 / 900) < 1e-9);
check("très grande image réduite pour la mémoire", ocrScale(4000, 8000) < 1 && 4000 * 8000 * ocrScale(4000, 8000) ** 2 <= 8_000_001);

const synthetic = (background: number, text: number, width = 40, height = 20) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const value = i % 7 === 0 ? text : background; // ~14 % de « texte »
    data.set([value, value, value, 255], i * 4);
  }
  return { data, width, height };
};
const light = synthetic(235, 60);
const lightResult = prepareForOcr(light);
check("fond clair : pas d'inversion, texte noir sur blanc", !lightResult.inverted && light.data[0] === 0 && light.data[4] === 255);
const dark = synthetic(25, 210);
const darkResult = prepareForOcr(dark);
check("mode sombre : image inversée en texte noir sur fond blanc", darkResult.inverted && dark.data[0] === 0 && dark.data[4] === 255);
const grey = synthetic(200, 150);
prepareForOcr(grey);
check("texte gris clair : contraste étiré au maximum", grey.data[0] === 0 && grey.data[4] === 255);
const noisy = synthetic(220, 80);
for (let i = 0; i < noisy.data.length; i += 4) {
  const jitter = (i / 4) % 3 === 0 ? 12 : -9;
  noisy.data[i] = noisy.data[i + 1] = noisy.data[i + 2] = noisy.data[i]! + jitter;
}
prepareForOcr(noisy, "binarized");
const values = new Set<number>();
for (let i = 0; i < noisy.data.length; i += 4) values.add(noisy.data[i]!);
check("variante binarisée : uniquement du noir et du blanc", [...values].every((value) => value === 0 || value === 255) && values.size === 2);

console.log("\nSECOND PASSAGE DE L'OCR");
check("bonne lecture : pas de second passage", !needsSecondPass(positionParserCases.boursoAppOcr) && !needsSecondPass(positionParserCases.boursoAppOcr2));
const degraded = positionParserCases.boursoAppOcr.replace("1122440€", "1224,40€");
check("ligne illisible (« 1224,40 € » pour 11 224,40 €) : second passage demandé", needsSecondPass(degraded));
check("la meilleure lecture l'emporte", captureQuality(positionParserCases.boursoAppOcr) > captureQuality(degraded));
check("livret lu : pas de second passage", !needsSecondPass(positionParserCases.livretA));

console.log("\nTEXTE ENVOYÉ PAR LE RACCOURCI IPHONE");
check("sans séparateur : une seule capture", splitCaptureText("Livret A\nSolde 12,00 €").length === 1);
const shortcut = [positionParserCases.boursoAppLiveText, positionParserCases.livretA].map((text) => `${CAPTURE_MARKER}\n${text}`).join("\n");
const parts = splitCaptureText(shortcut);
check("séparateur « === capture === » : une entrée par capture", parts.length === 2 && parts[0]!.startsWith("22 357,47 €") && parts[1]!.startsWith("Livret A"));
check("séparateur tolérant (espaces, casse)", splitCaptureText("A\n  ==  Capture ==  \nB").length === 2);
const loans = `${CAPTURE_MARKER}
Montant de votre prêt 117 000,00 €
Capital restant dû 88 523,83 €
Taux 1,30 %
Durée 300 mois
Date d'échéance 04/01/2045
${CAPTURE_MARKER}
Montant de l'amortissement 690,65 €
Capital amorti 594,75 €
Intérêts dus 95,90 €
Assurance due 0,00 €
Capital restant dû après amortissement 87 929,08 €
Date du prochain amortissement 04/12/2026`;
const merged = parseLoanCaptures(splitCaptureText(loans), new Date(2026, 10, 23, 15, 40)).prets;
check("deux captures d'un même crédit reçues du raccourci : fusionnées", merged.length === 1 && merged[0]?.captures === 2 && merged[0]?.mensualite === 690.65 && merged[0]?.refDate === "2026-11");

console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
if (failures) process.exitCode = 1;
