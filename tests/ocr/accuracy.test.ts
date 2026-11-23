/**
 * Garde-fou : le pipeline OCR doit lire au moins 90 % des champs exacts sur le jeu test, pour CHAQUE
 * courtier, et sur les vraies captures vérifiées (fixtures/real, si présentes). Le jeu dev ne sert
 * qu'à ajuster les règles, il n'est pas noté ici.
 *
 *   npm run test:ocr      (génère le corpus au premier lancement ; lectures OCR mises en cache)
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SOURCES } from "@/lib/ocr/expected";
import { ratio, type Tally } from "@/lib/ocr/score";
import { evaluate, type EvaluationSummary } from "../../scripts/ocr/evaluate";

const THRESHOLD = 0.9;
const describeTally = (t: Tally) => `${t.ok}/${t.total} = ${(ratio(t) * 100).toFixed(1)} %`;

let summary: EvaluationSummary;

beforeAll(async () => {
  if (!existsSync(join(process.cwd(), "fixtures", "synthetic", "manifest.json"))) {
    const run = spawnSync("npx", ["tsx", "scripts/ocr/corpus/generate.ts"], { stdio: "inherit" });
    if (run.status !== 0)
      throw new Error("Génération du corpus impossible (Chrome requis) : npm run corpus:generate");
  }
  ({ summary } = await evaluate({ sets: ["test", "real"], quiet: true }));
});

describe(`OCR des captures : au moins ${THRESHOLD * 100} % de champs exacts`, () => {
  for (const broker of SOURCES) {
    it(`jeu test — ${broker}`, () => {
      const t = summary.byBroker["test"]?.[broker];
      expect(t, `aucune capture test pour ${broker}`).toBeDefined();
      expect(ratio(t!), describeTally(t!)).toBeGreaterThanOrEqual(THRESHOLD);
    });
  }

  it("vraies captures vérifiées (fixtures/real)", ({ skip }) => {
    const t = summary.bySplit["real"];
    if (!t) skip("aucune vraie capture vérifiée dans fixtures/real");
    expect(ratio(t!), describeTally(t!)).toBeGreaterThanOrEqual(THRESHOLD);
  });
});
