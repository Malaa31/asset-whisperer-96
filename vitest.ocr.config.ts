import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuration à part (sans les plugins Lovable / TanStack) pour les tests du pipeline OCR.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/ocr/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    testTimeout: 60_000,
    hookTimeout: 20 * 60_000,
  },
});
