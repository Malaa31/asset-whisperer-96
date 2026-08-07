// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Identifiant de build : permet de verifier depuis l'app quelle version
// est reellement servie (voir src/lib/version.ts).
process.env["VITE_BUILD_ID"] =
  process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ?? String(Date.now()).slice(-7);
process.env["VITE_BUILD_DATE"] = new Date().toISOString().slice(0, 16).replace("T", " ");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
