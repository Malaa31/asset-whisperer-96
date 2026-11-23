/**
 * Préparer la « réponse attendue » de tes vraies captures (fixtures/real/, jamais versionné).
 *
 *   npm run fixture:real              pour chaque image sans .json : lecture OCR, puis questions
 *                                     dans le terminal (Entrée = garder la valeur proposée)
 *   npm run fixture:real -- --auto    écrit seulement les .json pré-remplis ("verifie": false)
 *   npm run fixture:real -- --check   état des captures et contrôle des .json existants
 *   npm run fixture:real -- --force   refait aussi les captures qui ont déjà un .json
 *
 * Une capture n'entre dans le score « real » que lorsque son .json porte "verifie": true.
 * Format détaillé : fixtures/README.md.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  SOURCES,
  type CaptureSource,
  type ExpectedCapture,
  type ExpectedPosition,
} from "../../src/lib/ocr/expected";
import { instrumentByIsin } from "../../src/lib/ocr/instruments";
import { runPipelineOnOcr } from "../../src/lib/ocr/pipeline";
import { parseFrenchNumber } from "../../src/lib/import-positions";
import { isValidIsin } from "../../src/lib/position-parser";
import { createNodeEngine } from "./engine-node";

type RealCapture = ExpectedCapture & { verifie: boolean };

const DIR = process.env.REAL_FIXTURES_DIR ?? join(process.cwd(), "fixtures", "real");
const IMAGE = /\.(png|jpe?g)$/i;
const args = new Set(process.argv.slice(2));

function images(): string[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((name) => IMAGE.test(name))
    .sort();
}

const jsonPath = (image: string) => join(DIR, image.replace(IMAGE, ".json"));

/** Problèmes de forme d'un .json (pas de justesse : ça, c'est à toi de le vérifier). */
function validate(capture: RealCapture): string[] {
  const problems: string[] = [];
  if (capture.version !== 1) problems.push("version doit valoir 1");
  if (![...SOURCES, "autre"].includes(capture.broker))
    problems.push(`courtier inconnu : ${capture.broker}`);
  if (!["positions", "livret"].includes(capture.kind))
    problems.push("kind : « positions » ou « livret »");
  if (capture.total !== null && typeof capture.total !== "number")
    problems.push("total : nombre ou null");
  if (capture.kind === "livret" && !capture.libelle) problems.push("livret sans libellé");
  if (capture.kind === "positions" && !capture.positions.length) problems.push("aucune position");
  capture.positions.forEach((position, index) => {
    const label = `ligne ${index + 1}`;
    if (!position.nom) problems.push(`${label} : nom vide`);
    if (position.isin && !isValidIsin(position.isin))
      problems.push(`${label} : ISIN invalide (${position.isin})`);
    for (const key of ["quantite", "pru", "valorisation"] as const) {
      const value = position[key];
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0))
        problems.push(`${label} : ${key} doit être un nombre positif ou null`);
    }
  });
  const sum = capture.positions.reduce((acc, position) => acc + (position.valorisation ?? 0), 0);
  if (capture.kind === "positions" && capture.total !== null && sum > capture.total + 0.05) {
    problems.push(
      `somme des lignes (${sum.toFixed(2)}) supérieure au total (${capture.total.toFixed(2)})`,
    );
  }
  if (typeof capture.verifie !== "boolean") problems.push("verifie : true ou false");
  return problems;
}

function check(): void {
  const list = images();
  if (!list.length) {
    console.log(
      "fixtures/real/ est vide : dépose-y tes captures (PNG ou JPEG), puis relance « npm run fixture:real ».",
    );
    return;
  }
  for (const image of list) {
    const path = jsonPath(image);
    if (!existsSync(path)) {
      console.log(`  ·  ${image} : pas encore de .json`);
      continue;
    }
    const capture = JSON.parse(readFileSync(path, "utf8")) as RealCapture;
    const problems = validate(capture);
    const state = problems.length ? "✗" : capture.verifie ? "✓" : "…";
    console.log(
      `  ${state}  ${image} : ${capture.broker}, ${capture.kind}, ${capture.positions.length} ligne(s)${capture.verifie ? "" : " — à vérifier"}`,
    );
    for (const problem of problems) console.log(`       - ${problem}`);
  }
  console.log(
    "\n✓ vérifiée (comptée dans le score)   … pré-remplie, pas encore vérifiée   ✗ à corriger",
  );
}

function format(value: number | string | null): string {
  if (value === null || value === "") return "—";
  return typeof value === "number"
    ? value.toLocaleString("fr-FR", { maximumFractionDigits: 6 })
    : value;
}

async function interactive(capture: RealCapture, image: string): Promise<RealCapture> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label: string, current: number | string | null): Promise<string> =>
    (await rl.question(`  ${label} [${format(current)}] : `)).trim();
  const askNumber = async (label: string, current: number | null): Promise<number | null> => {
    for (;;) {
      const answer = await ask(label, current);
      if (!answer) return current;
      if (answer === "-") return null;
      const value = parseFrenchNumber(answer);
      if (value !== null) return value;
      console.log("    nombre attendu (ex. 1 234,56), « - » pour vide");
    }
  };
  try {
    console.log(`\n=== ${image} — Entrée = garder, « - » = vider`);
    const broker = await ask(`courtier (${SOURCES.join(", ")}, autre)`, capture.broker);
    if (broker) capture.broker = broker as CaptureSource;
    const kind = await ask("type (positions / livret)", capture.kind);
    if (kind === "positions" || kind === "livret") capture.kind = kind;
    if (capture.kind === "livret") {
      const libelle = await ask("libellé", capture.libelle);
      if (libelle) capture.libelle = libelle === "-" ? null : libelle;
      capture.enveloppe = null;
      capture.positions = [];
    } else {
      const enveloppe = await ask("enveloppe (PEA / CTO)", capture.enveloppe);
      if (enveloppe)
        capture.enveloppe = enveloppe === "-" ? null : (enveloppe.toUpperCase() as "PEA" | "CTO");
    }
    capture.total = await askNumber(
      capture.kind === "livret" ? "solde" : "total du compte",
      capture.total,
    );

    if (capture.kind === "positions") {
      const kept: ExpectedPosition[] = [];
      for (const [index, position] of capture.positions.entries()) {
        console.log(
          `\n  ligne ${index + 1} : ${position.nom} · ${format(position.quantite)} × PRU ${format(position.pru)} = ${format(position.valorisation)} €`,
        );
        const action = (
          await rl.question(
            "  Entrée = juste · c = corriger · s = supprimer (ligne lue en trop) : ",
          )
        )
          .trim()
          .toLowerCase();
        if (action === "s") continue;
        if (action === "c") await editPosition(position);
        kept.push(position);
      }
      for (;;) {
        const more = (
          await rl.question(
            "\n  Une ligne visible n'a pas été lue ? a = l'ajouter, Entrée = non : ",
          )
        )
          .trim()
          .toLowerCase();
        if (more !== "a") break;
        const position: ExpectedPosition = {
          nom: "",
          isin: null,
          quantite: null,
          pru: null,
          valorisation: null,
        };
        await editPosition(position);
        kept.push(position);
      }
      capture.positions = kept;
    }
    const notes = await ask("note (facultatif)", capture.notes ?? "");
    if (notes === "-") delete capture.notes;
    else if (notes) capture.notes = notes;
    const problems = validate({ ...capture, verifie: true });
    if (problems.length) {
      console.log("  ⚠ à revoir : " + problems.join(" ; "));
      capture.verifie = false;
    } else {
      capture.verifie = (await rl.question("  Tout correspond à l'écran ? (o/N) : "))
        .trim()
        .toLowerCase()
        .startsWith("o");
    }
    return capture;

    async function editPosition(position: ExpectedPosition) {
      const isin = await ask("ISIN", position.isin);
      if (isin) position.isin = isin === "-" ? null : isin.toUpperCase();
      const known = position.isin ? instrumentByIsin(position.isin) : undefined;
      const nom = await ask("nom", position.nom || known?.name || null);
      if (nom) position.nom = nom;
      else if (!position.nom && known) position.nom = known.name;
      position.quantite = await askNumber("quantité", position.quantite);
      position.pru = await askNumber("PRU (- si non affiché)", position.pru);
      position.valorisation = await askNumber("valorisation", position.valorisation);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  if (args.has("--check")) return check();
  const list = images().filter((image) => args.has("--force") || !existsSync(jsonPath(image)));
  if (!list.length) {
    console.log(
      images().length
        ? "Toutes les captures ont un .json (« --force » pour refaire, « --check » pour l'état)."
        : "fixtures/real/ est vide : dépose-y tes captures (PNG ou JPEG).",
    );
    return check();
  }
  const engine = await createNodeEngine();
  const ask = !args.has("--auto") && process.stdin.isTTY;
  try {
    for (const image of list) {
      const page = await engine.read(join(DIR, image));
      const result = runPipelineOnOcr(page);
      let capture: RealCapture = {
        version: 1,
        source: "real",
        broker: result.broker,
        kind: result.kind,
        enveloppe: result.enveloppe,
        libelle: result.libelle,
        total: result.total,
        positions: result.positions.map((position) => ({
          nom: position.nom,
          isin: position.isin,
          quantite: position.quantite,
          pru: position.pru,
          valorisation: position.valorisation,
        })),
        verifie: false,
      };
      if (ask) capture = await interactive(capture, image);
      writeFileSync(jsonPath(image), `${JSON.stringify(capture, null, 2)}\n`);
      console.log(
        `→ ${image.replace(IMAGE, ".json")} ${capture.verifie ? "vérifiée" : 'pré-remplie ("verifie": false) : corrige-la puis passe verifie à true'}`,
      );
    }
  } finally {
    await engine.destroy();
  }
  console.log("");
  check();
}

await main();
