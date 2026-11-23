/** Texte OCR (après lignes/colonnes) et lecture d'une capture précise. npx tsx scripts/ocr/show.ts trade-republic-04 */
import { readFileSync } from "node:fs";
import { createNodeEngine } from "./engine-node";
import { runPipelineOnOcr } from "../../src/lib/ocr/pipeline";
import { groupRows } from "../../src/lib/ocr/layout";
const manifest = JSON.parse(readFileSync("fixtures/synthetic/manifest.json", "utf8"))
  .entries as Array<{ id: string; image: string; expected: string }>;
const engine = await createNodeEngine();
for (const id of process.argv.slice(2)) {
  const entry = manifest.find((e) => e.id === id) ?? {
    id,
    image: `fixtures/real/${id}.png`,
    expected: `fixtures/real/${id}.json`,
  };
  const page = await engine.read(entry.image);
  console.log(`===== ${id}`);
  for (const row of groupRows(page.boxes))
    console.log(
      row.boxes.map((b) => `${b.text}{${Math.round(b.x)},${b.confidence.toFixed(2)}}`).join(" | "),
    );
  const result = runPipelineOnOcr(page);
  console.log(
    "-- lu",
    JSON.stringify(
      result.positions.map((p) => [p.nom.slice(0, 24), p.quantite, p.pru, p.valorisation]),
    ),
    "total",
    result.total,
  );
}
await engine.destroy();
