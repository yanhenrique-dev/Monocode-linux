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
    // Repo convention: DOM only via per-file `// @vitest-environment happy-dom`
    // pragmas. Tests without pragma (e.g. AgentTranscript.test.ts reading CSS
    // via import.meta.url) require node: happy-dom rewrites import.meta.url
    // to a non-file scheme and breaks file reads.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 10_000,
  },
});
