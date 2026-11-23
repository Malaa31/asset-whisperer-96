/** Aide au réglage : texte OCR et erreurs des captures dev d'une source.  npx tsx scripts/ocr/inspect.ts fortuneo 3 */
import { evaluate } from "./evaluate";
const [broker, count = "3", set = "dev"] = process.argv.slice(2);
const { evaluations } = await evaluate({
  sets: [set as "dev"],
  ...(broker ? { broker } : {}),
  quiet: true,
});
for (const evaluation of evaluations.slice(0, Number(count))) {
  const bad = evaluation.scores.filter((s) => !s.ok);
  console.log(
    `\n===== ${evaluation.entry.id} ${evaluation.scores.length - bad.length}/${evaluation.scores.length} [${evaluation.result.broker}/${evaluation.result.kind}] total=${evaluation.result.total}`,
  );
  console.log(evaluation.ocrText);
  console.log(
    "-- lu :",
    JSON.stringify(
      evaluation.result.positions.map((p) => [
        p.nom.slice(0, 30),
        p.isin,
        p.quantite,
        p.pru,
        p.cours,
        p.valorisation,
      ]),
    ),
  );
  for (const s of bad)
    console.log(
      `   ✗ ${s.field} ${s.position ?? ""} attendu ${JSON.stringify(s.expected)} lu ${JSON.stringify(s.got)}`,
    );
}
