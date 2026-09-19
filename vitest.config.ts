import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Mirrors the `@/*` path alias from tsconfig so tests can import modules the
 * same way the app does. Without this, any module that uses the alias is
 * simply unimportable from a test, which quietly limits what can be tested.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
