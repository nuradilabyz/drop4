import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for the Drop4 engine.
 *
 * - Node environment (the engine is pure; no DOM needed for the heavy logic).
 * - `test.include` scoped to *.test.ts so we only run engine specs.
 * - `@` alias → repo root so `@/engine/...` imports resolve in tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
