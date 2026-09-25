import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    environment: "happy-dom",
    // icons.test.ts reads source files via fileURLToPath: needs node, not DOM.
    environmentMatchGlobs: [
      ["src/chrome/icons.test.ts", "node"],
      ["src/**/*.test.{ts,tsx}", "happy-dom"],
    ],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 10_000,
  },
});
