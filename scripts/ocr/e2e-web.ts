/**
 * Vérification de bout en bout dans un vrai navigateur : ouvre /patrimoine, importe une capture,
 * attend l'écran de revue et compte les champs surlignés en orange. Toute requête qui sortirait de
 * l'appli est bloquée et fait échouer le test (l'OCR doit rester 100 % local).
 *
 *   npx tsx scripts/ocr/e2e-web.ts http://127.0.0.1:4173 fixtures/synthetic/fortuneo/fortuneo-02.png [sortie.png]
 */
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4173", image, screenshot = "reports/ocr/e2e.png"] =
  process.argv.slice(2);
if (!image) {
  console.error("usage: e2e-web.ts <url> <image> [capture.png]");
  process.exit(2);
}

const origin = new URL(base).origin;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
});
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const outside: string[] = [];
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:"))
    return route.continue();
  outside.push(url);
  return route.abort();
});
page.on("pageerror", (error) => console.error("page error:", error.message));

const started = Date.now();
await page.goto(`${base}/patrimoine`, { waitUntil: "networkidle" });
// Premier lancement : passe l'accueil (prénom, profil de risque, versements).
const onboarding = page.getByPlaceholder("Alex");
if (await onboarding.isVisible().catch(() => false)) {
  await onboarding.fill("Test");
  await page.getByRole("button", { name: /Continuer/ }).click();
  const choices = page.locator("main button, [role=dialog] button, body button");
  for (let step = 0; step < 2; step += 1) {
    const next = page.getByRole("button", { name: /Continuer/ });
    if (!(await next.isVisible().catch(() => false))) break;
    if (await next.isDisabled()) await choices.first().click();
    await next.click();
  }
  await page.getByRole("button", { name: /Explorer d'abord/ }).click();
  await page.goto(`${base}/patrimoine`, { waitUntil: "networkidle" });
}
await page
  .getByRole("button", { name: /Importer/ })
  .first()
  .click();
await page.locator('input[type="file"]').setInputFiles(image);
await page.getByRole("button", { name: "Analyser les captures" }).click();
await page.getByText("Lecture en cours…").waitFor({ state: "detached", timeout: 180_000 });
const seconds = ((Date.now() - started) / 1000).toFixed(1);

const orange = await page.locator('[data-alert="true"]').count();
const reasons = await page.locator("[data-position-card] span.text-orange").allInnerTexts();
const lines = await page.locator("[data-position-card]").count();
await page.screenshot({ path: screenshot });

// Contrôle en direct : une quantité fausse doit passer le champ en orange.
const card = page.locator("[data-position-card]").first();
const quantity = card.getByLabel(/Quantit/);
let orangeAfterEdit: number | null = null;
if (lines && (await quantity.count())) {
  const original = await quantity.inputValue();
  await quantity.fill(String(Number(original.replace(",", ".")) * 2 || 999));
  orangeAfterEdit = await card.locator('[data-alert="true"]').count();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshot.replace(/\.png$/, "-orange.png") });
}
await browser.close();

console.log(
  JSON.stringify(
    { seconds, lines, orange, reasons, orangeAfterEdit, outside, screenshot },
    null,
    2,
  ),
);
if (orangeAfterEdit === 0) {
  console.error("Une quantité incohérente n'a pas été surlignée.");
  process.exit(1);
}
if (outside.length) {
  console.error("Requêtes hors de l'appli détectées.");
  process.exit(1);
}
if (!lines) {
  console.error("Aucune ligne lue.");
  process.exit(1);
}
