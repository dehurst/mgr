import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // Server-only modules are fine to import in tests (the real package throws outside Next).
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: { include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**"] },
});
