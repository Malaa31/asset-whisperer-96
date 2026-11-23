/**
 * Génère le corpus synthétique : SOURCES × 40 captures, rendues avec Playwright (Chrome),
 * et la réponse attendue de chacune, déduite de ce qui est réellement visible à l'écran.
 *
 *   npm run corpus:generate            (tout)
 *   npm run corpus:generate -- boursorama 5   (une source, 5 captures, pour vérifier un gabarit)
 *
 * Reproductible : même graine → mêmes captures. Sortie dans fixtures/synthetic/ (ignoré par git).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright-core";
import {
  SOURCES,
  type CaptureSource,
  type ExpectedCapture,
  type FixtureEntry,
} from "../../../src/lib/ocr/expected";
import { generatePortfolio, generateSavings, rng } from "./data";
import { renderTemplate } from "./templates";

export const CORPUS_VERSION = "corpus-v4";
const SEED = 20261123;
const PER_SOURCE = 40;
const OUT = join(process.cwd(), "fixtures", "synthetic");

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667, scale: 2 },
  { name: "iphone-13", width: 390, height: 844, scale: 3 },
  { name: "iphone-15-pro-max", width: 430, height: 932, scale: 3 },
  { name: "pixel-7", width: 412, height: 915, scale: 2.625 },
  { name: "android-small", width: 360, height: 800, scale: 3 },
];

const DARK_RATE: Record<CaptureSource, number> = {
  boursorama: 0.3,
  "trade-republic": 0.7,
  fortuneo: 0.3,
  "bourse-direct": 0,
  degiro: 0.4,
  "credit-agricole": 0.25,
  autre: 0,
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 30 % en test, de façon fixe : indices 2, 5, 8 de chaque dizaine. */
export function splitFor(index: number): "dev" | "test" {
  return [2, 5, 8].includes(index % 10) ? "test" : "dev";
}

async function renderOne(
  browser: Browser,
  source: CaptureSource,
  index: number,
): Promise<FixtureEntry> {
  const id = `${source}-${String(index + 1).padStart(2, "0")}`;
  const random = rng(SEED ^ hash(id));
  const viewport = random.pick(VIEWPORTS);
  const dark = random.chance(DARK_RATE[source]);
  const statusBar = random.chance(0.7);

  const input =
    source === "credit-agricole"
      ? {
          savings: generateSavings(random, "Livret A"),
          otherSavings: random
            .shuffle([generateSavings(random, "LDDS"), generateSavings(random, "LEP")])
            .slice(0, random.int(0, 2)),
          list: random.chance(0.3),
        }
      : {
          portfolio: generatePortfolio(random, {
            count: random.int(3, 7),
            fractional: source === "trade-republic",
            ...(source === "trade-republic" ? {} : {}),
          }),
        };
  const template = renderTemplate(source, input, { dark, statusBar, random });

  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale,
  });
  await page.setContent(template.html, { waitUntil: "load" });
  await page.evaluate("document.fonts.ready");

  // Recadrage : rien, la barre d'état en moins, ou une bande de l'écran.
  let top = 0;
  let bottom = viewport.height;
  const crop = random.next();
  if (crop < 0.15) top = random.int(30, 60);
  else if (crop < 0.3) {
    top = random.int(0, 160);
    bottom = viewport.height - random.int(0, 120);
  }
  const clip = { x: 0, y: top, width: viewport.width, height: bottom - top };

  // Code passé en texte : tsx ajoute des aides (__name) inconnues de la page.
  const geometry = (await page.evaluate(`(() => {
    // Limites du texte lui-même (sans les marges) : une ligne lisible au-dessus de la barre d'onglets est visible.
    const rect = (element) => { const range = document.createRange(); range.selectNodeContents(element); const box = range.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; };
    return {
      positions: [...document.querySelectorAll("[data-pos]")].map((element) => ({ index: Number(element.dataset.pos), ...rect(element) })),
      total: [...document.querySelectorAll("[data-total]")].map(rect)[0] ?? null,
      libelle: [...document.querySelectorAll("[data-libelle]")].map(rect)[0] ?? null,
      tab: document.querySelector("[data-tabbar]")?.getBoundingClientRect().top ?? null,
    };
  })()`)) as {
    tab: number | null;
    positions: Array<{ index: number; top: number; bottom: number }>;
    total: { top: number; bottom: number } | null;
    libelle: { top: number; bottom: number } | null;
  };
  // La barre d'onglets fixe masque ce qui passe dessous.
  const visibleBottom = Math.min(bottom, geometry.tab ?? Number.POSITIVE_INFINITY);
  // Tolérance de 6 px : la boîte de ligne déborde un peu des caractères, encore lisibles.
  const inside = (box: { top: number; bottom: number } | null) =>
    Boolean(box && box.top >= top - 6 && box.bottom <= visibleBottom + 6);

  const jpeg = random.chance(0.35);
  const quality = random.int(55, 85);
  const extension = jpeg ? "jpg" : "png";
  const dir = join(OUT, source);
  mkdirSync(dir, { recursive: true });
  const imagePath = join(dir, `${id}.${extension}`);
  await page.screenshot({
    path: imagePath,
    clip,
    type: jpeg ? "jpeg" : "png",
    ...(jpeg ? { quality } : {}),
  });
  await page.close();

  const visible = geometry.positions
    .filter(inside)
    .map((position) => position.index)
    .sort((a, b) => a - b);
  const expected: ExpectedCapture = {
    version: 1,
    source: "synthetic",
    broker: source,
    kind: template.kind,
    enveloppe: template.enveloppe,
    libelle: template.kind === "livret" && inside(geometry.libelle) ? template.libelle : null,
    total:
      template.shows.total && inside(geometry.total)
        ? template.kind === "livret"
          ? input.savings!.solde
          : input.portfolio!.total
        : null,
    positions:
      template.kind === "positions"
        ? visible.map((positionIndex) => {
            const position = input.portfolio!.positions[positionIndex]!;
            return {
              nom: template.names[positionIndex]!,
              isin: position.instrument.isin,
              quantite: template.shows.quantite ? position.quantite : null,
              pru: template.shows.pru ? position.pru : null,
              valorisation: template.shows.valorisation ? position.valorisation : null,
            };
          })
        : [],
    notes: `${viewport.name}${dark ? " sombre" : " clair"}${statusBar ? " · barre d'état" : ""}${top || bottom < viewport.height ? ` · recadré ${top}-${bottom}` : ""}${jpeg ? ` · jpeg q${quality}` : ""}`,
  };
  const expectedPath = join(dir, `${id}.json`);
  writeFileSync(expectedPath, `${JSON.stringify(expected, null, 2)}\n`);
  return {
    id,
    broker: source,
    image: imagePath.replace(`${process.cwd()}/`, ""),
    expected: expectedPath.replace(`${process.cwd()}/`, ""),
    split: splitFor(index),
  };
}

async function main() {
  const [onlySource, onlyCount] = process.argv.slice(2);
  const sources = onlySource
    ? (SOURCES.filter((source) => source === onlySource) as CaptureSource[])
    : SOURCES;
  const count = onlyCount ? Number(onlyCount) : PER_SOURCE;
  if (!onlySource) rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
  const entries: FixtureEntry[] = [];
  try {
    for (const source of sources) {
      for (let index = 0; index < count; index++)
        entries.push(await renderOne(browser, source, index));
      console.log(`${source} : ${count} captures`);
    }
  } finally {
    await browser.close();
  }
  if (!onlySource) {
    writeFileSync(
      join(OUT, "manifest.json"),
      `${JSON.stringify({ version: CORPUS_VERSION, seed: SEED, entries }, null, 2)}\n`,
    );
    const test = entries.filter((entry) => entry.split === "test").length;
    console.log(
      `${entries.length} captures (${entries.length - test} dev, ${test} test) → fixtures/synthetic/`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
