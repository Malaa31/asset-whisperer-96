// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    resolve: {
      // OCR local : version WebAssembly seule d'ONNX Runtime (sans WebGPU, 12 Mo au lieu de 23),
      // pour le SDK PaddleOCR comme pour nous. Le .wasm est empaqueté et servi par l'appli.
      alias: [{ find: /^onnxruntime-web$/, replacement: "onnxruntime-web/wasm" }],
    },
    optimizeDeps: { exclude: ["onnxruntime-web", "ppu-paddle-ocr"] },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
