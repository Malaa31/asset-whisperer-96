/**
 * Évaluation du pipeline OCR sur le corpus : synthétique (dev / test) et vraies captures (real).
 *
 *   npm run eval:ocr                          tout
 *   npm run eval:ocr -- --sets dev            un seul jeu
 *   npm run eval:ocr -- --journal "Regex EUR" ajoute une ligne au journal (docs/ocr-journal.md)
 *
 * Rapports : reports/ocr/report.md, reports/ocr/report.html (10 pires erreurs avec l'image et le
 * texte lu par l'OCR), reports/ocr/latest.json. Rien de tout ça n'est versionné.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import type { ExpectedCapture, FixtureEntry } from "../../src/lib/ocr/expected";
import { runPipelineOnOcr, type PipelineResult } from "../../src/lib/ocr/pipeline";
import { ratio, scoreCapture, tally, type FieldScore, type Tally } from "../../src/lib/ocr/score";
import { createNodeEngine } from "./engine-node";

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, "reports", "ocr");
type Split = FixtureEntry["split"];

export interface CaptureEvaluation {
  entry: FixtureEntry;
  expected: ExpectedCapture;
  result: PipelineResult;
  scores: FieldScore[];
  ocrText: string;
}

export interface EvaluationSummary {
  date: string;
  config: string;
  bySplit: Record<string, Tally>;
  byBroker: Record<string, Record<string, Tally>>;
  byField: Record<string, Record<string, Tally>>;
  captures: number;
  skippedReal: string[];
}

export function realEntries(): { entries: FixtureEntry[]; skipped: string[] } {
  const dir = join(ROOT, "fixtures", "real");
  if (!existsSync(dir)) return { entries: [], skipped: [] };
  const entries: FixtureEntry[] = [];
  const skipped: string[] = [];
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()) {
    const base = file.replace(/\.json$/, "");
    const image = ["png", "jpg", "jpeg", "PNG", "JPG", "JPEG"]
      .map((ext) => join(dir, `${base}.${ext}`))
      .find(existsSync);
    const expected = JSON.parse(readFileSync(join(dir, file), "utf8")) as ExpectedCapture & {
      verifie?: boolean;
    };
    if (!image) continue;
    if (expected.verifie === false) {
      skipped.push(base);
      continue;
    }
    entries.push({
      id: `real/${base}`,
      broker: expected.broker,
      image: relative(ROOT, image),
      expected: relative(ROOT, join(dir, file)),
      split: "real",
    });
  }
  return { entries, skipped };
}

export async function evaluate(
  options: { sets?: Split[]; broker?: string; limit?: number; quiet?: boolean } = {},
) {
  const sets = options.sets ?? ["dev", "test", "real"];
  const manifestPath = join(ROOT, "fixtures", "synthetic", "manifest.json");
  const synthetic: FixtureEntry[] = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as { entries: FixtureEntry[] }).entries
    : [];
  if (!synthetic.length && sets.some((set) => set !== "real"))
    throw new Error("Corpus absent : lance d'abord « npm run corpus:generate ».");
  const real = realEntries();
  let entries = [...synthetic, ...real.entries].filter((entry) => sets.includes(entry.split));
  if (options.broker) entries = entries.filter((entry) => entry.broker === options.broker);
  if (options.limit) entries = entries.slice(0, options.limit);

  const engine = await createNodeEngine();
  const evaluations: CaptureEvaluation[] = [];
  let fresh = 0;
  for (const [index, entry] of entries.entries()) {
    const expected = JSON.parse(
      readFileSync(join(ROOT, entry.expected), "utf8"),
    ) as ExpectedCapture;
    const page = await engine.read(join(ROOT, entry.image));
    if (!page.cached) fresh++;
    const result = runPipelineOnOcr(page);
    evaluations.push({
      entry,
      expected,
      result,
      scores: scoreCapture(expected, result),
      ocrText: result.text,
    });
    if (!options.quiet && !page.cached && (index + 1) % 20 === 0)
      console.log(`  OCR ${index + 1}/${entries.length}…`);
  }
  await engine.destroy();

  const summary: EvaluationSummary = {
    date: new Date().toISOString(),
    config: engine.configKey,
    bySplit: {},
    byBroker: {},
    byField: {},
    captures: evaluations.length,
    skippedReal: real.skipped,
  };
  const add = (bucket: Tally | undefined, scores: FieldScore[]): Tally => {
    const t = tally(scores);
    return { ok: (bucket?.ok ?? 0) + t.ok, total: (bucket?.total ?? 0) + t.total };
  };
  for (const evaluation of evaluations) {
    const { split, broker } = evaluation.entry;
    summary.bySplit[split] = add(summary.bySplit[split], evaluation.scores);
    summary.byBroker[split] ??= {};
    summary.byBroker[split]![broker] = add(summary.byBroker[split]![broker], evaluation.scores);
    summary.byField[split] ??= {};
    for (const score of evaluation.scores)
      summary.byField[split]![score.field] = add(summary.byField[split]![score.field], [score]);
  }
  return { summary, evaluations, freshOcr: fresh };
}

const pct = (t: Tally | undefined) => (t ? `${(ratio(t) * 100).toFixed(1)} %` : "—");

function markdown(summary: EvaluationSummary, evaluations: CaptureEvaluation[]): string {
  const splits = Object.keys(summary.bySplit);
  const brokers = [...new Set(evaluations.map((evaluation) => evaluation.entry.broker))];
  const fields = [
    ...new Set(evaluations.flatMap((evaluation) => evaluation.scores.map((score) => score.field))),
  ];
  const lines = [
    `# Évaluation OCR — ${summary.date.slice(0, 16).replace("T", " ")}`,
    "",
    `${summary.captures} captures. Champs exacts :`,
    "",
    `| Jeu | ${splits.join(" | ")} |`,
    `| --- | ${splits.map(() => "---").join(" | ")} |`,
    `| **Global** | ${splits.map((split) => `**${pct(summary.bySplit[split])}** (${summary.bySplit[split]!.ok}/${summary.bySplit[split]!.total})`).join(" | ")} |`,
    ...brokers.map(
      (broker) =>
        `| ${broker} | ${splits
          .map((split) => {
            const t = summary.byBroker[split]?.[broker];
            return t ? `${pct(t)} (${t.ok}/${t.total})` : "—";
          })
          .join(" | ")} |`,
    ),
    "",
    "Par champ :",
    "",
    `| Champ | ${splits.join(" | ")} |`,
    `| --- | ${splits.map(() => "---").join(" | ")} |`,
    ...fields.map(
      (field) =>
        `| ${field} | ${splits
          .map((split) => {
            const t = summary.byField[split]?.[field];
            return t ? `${pct(t)} (${t.ok}/${t.total})` : "—";
          })
          .join(" | ")} |`,
    ),
  ];
  if (summary.skippedReal.length)
    lines.push("", `Vraies captures non vérifiées (ignorées) : ${summary.skippedReal.join(", ")}`);
  lines.push("", "## 10 pires erreurs", "");
  for (const evaluation of worst(evaluations)) {
    const t = tally(evaluation.scores);
    lines.push(
      `### ${evaluation.entry.id} (${evaluation.entry.split}) — ${t.ok}/${t.total}`,
      "",
      `Image : ${evaluation.entry.image}`,
      "",
    );
    for (const score of evaluation.scores.filter((s) => !s.ok)) {
      lines.push(
        `- ${score.field}${score.position ? ` · ${score.position}` : ""} : attendu ${JSON.stringify(score.expected)}, lu ${JSON.stringify(score.got)}`,
      );
    }
    lines.push("", "```", evaluation.ocrText, "```", "");
  }
  return lines.join("\n");
}

function worst(evaluations: CaptureEvaluation[]): CaptureEvaluation[] {
  return [...evaluations]
    .filter((evaluation) => evaluation.scores.some((score) => !score.ok))
    .sort(
      (a, b) =>
        ratio(tally(a.scores)) - ratio(tally(b.scores)) ||
        tally(b.scores).total - tally(a.scores).total,
    )
    .slice(0, 10);
}

function html(summary: EvaluationSummary, evaluations: CaptureEvaluation[]): string {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const blocks = worst(evaluations)
    .map((evaluation) => {
      const t = tally(evaluation.scores);
      const errors = evaluation.scores
        .filter((s) => !s.ok)
        .map(
          (s) =>
            `<li><b>${s.field}</b>${s.position ? ` · ${escape(s.position)}` : ""} : attendu <code>${escape(JSON.stringify(s.expected))}</code>, lu <code>${escape(JSON.stringify(s.got))}</code></li>`,
        )
        .join("");
      return `<section><h2>${evaluation.entry.id} <small>(${evaluation.entry.split}) ${t.ok}/${t.total}</small></h2><div class="row"><img src="${relative(REPORT_DIR, join(ROOT, evaluation.entry.image))}"><div><ul>${errors}</ul><pre>${escape(evaluation.ocrText)}</pre></div></div></section>`;
    })
    .join("");
  const md = escape(markdown(summary, evaluations).split("## 10 pires erreurs")[0]!);
  return `<!doctype html><meta charset="utf-8"><title>Évaluation OCR</title><style>body{font:14px system-ui;margin:24px;max-width:1200px}.row{display:flex;gap:16px;align-items:flex-start}img{width:280px;border:1px solid #ccc}pre{background:#f5f5f5;padding:8px;white-space:pre-wrap;font-size:12px}code{background:#f0f0f0}</style><pre>${md}</pre><h1>10 pires erreurs</h1>${blocks}`;
}

export function writeReports(summary: EvaluationSummary, evaluations: CaptureEvaluation[]) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, "report.md"), markdown(summary, evaluations));
  writeFileSync(join(REPORT_DIR, "report.html"), html(summary, evaluations));
  writeFileSync(
    join(REPORT_DIR, "latest.json"),
    JSON.stringify(
      {
        summary,
        captures: evaluations.map((e) => ({
          id: e.entry.id,
          split: e.entry.split,
          broker: e.entry.broker,
          ...tally(e.scores),
          errors: e.scores.filter((s) => !s.ok),
        })),
      },
      null,
      2,
    ),
  );
}

function appendJournal(change: string, summary: EvaluationSummary) {
  const path = join(ROOT, "docs", "ocr-journal.md");
  if (!existsSync(path)) {
    mkdirSync(join(ROOT, "docs"), { recursive: true });
    writeFileSync(
      path,
      "# Journal des améliorations OCR\n\nUne ligne par changement, évaluation relancée à chaque fois. Les règles ne sont ajustées que sur **dev**.\n\n| Date | Changement | dev | test | real | test par courtier |\n| --- | --- | --- | --- | --- | --- |\n",
    );
  }
  const test = summary.byBroker.test ?? {};
  const perBroker = Object.entries(test)
    .map(([broker, t]) => `${broker} ${(ratio(t) * 100).toFixed(0)}`)
    .join(" · ");
  appendFileSync(
    path,
    `| ${summary.date.slice(0, 16).replace("T", " ")} | ${change} | ${pct(summary.bySplit.dev)} | ${pct(summary.bySplit.test)} | ${pct(summary.bySplit.real)} | ${perBroker} |\n`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const sets = value("--sets")?.split(",") as Split[] | undefined;
  const started = Date.now();
  const { summary, evaluations, freshOcr } = await evaluate({
    ...(sets ? { sets } : {}),
    ...(value("--broker") ? { broker: value("--broker")! } : {}),
    ...(value("--limit") ? { limit: Number(value("--limit")) } : {}),
  });
  writeReports(summary, evaluations);
  console.log(markdown(summary, evaluations).split("## 10 pires erreurs")[0]);
  console.log(
    `(${freshOcr} lectures OCR, ${Math.round((Date.now() - started) / 1000)} s) → reports/ocr/report.html`,
  );
  const change = value("--journal");
  if (change) appendJournal(change, summary);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
