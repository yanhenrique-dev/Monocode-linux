// Clean-code baseline: warn-only gates so `npm run lint` reports without
// blocking the build. Promote to error per directory as each phase lands.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "target/**", "node_modules/**", "src-tauri/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // God-component hotspots: tighter budgets, still warn until split.
    files: [
      "src/surfaces/**/*.tsx",
      "src/chrome/**/*.tsx",
      "src/app/**/*.ts",
    ],
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-params": ["warn", 3],
      complexity: ["warn", 10],
      "max-nested-callbacks": ["warn", 3],
    },
  },
  {
    // New split modules (Fases 1-4): strict any/assertion from birth.
    files: [
      "src/lib/motion.ts",
      "src/hooks/useAnimatedReorder.ts",
      "src/hooks/useExitAnimation.ts",
      "src/hooks/useSortable.ts",
      "src/surfaces/Shimmer.tsx",
      "src/app/sessionSync/**/*.ts",
      "src/app/composer/**/*.ts",
      "src/chrome/sidebar/**/*.tsx",
      "src/chrome/sidebar/**/*.ts",
      "src/chrome/composer/**/*.tsx",
      "src/surfaces/settings/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "max-lines": "off",
      "max-params": "off",
      complexity: "off",
    },
  },
  {
    // Build and release scripts run in Node, not the browser, and they are
    // release-critical: the version pins, the updater manifest, and the Flatpak
    // gate all decide what ships. They sat outside `npm run lint` entirely, so
    // nothing checked them. Declaring the environment is what makes them
    // lintable rather than merely included -- without it `no-undef` fires on
    // every Node global they legitimately use.
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
      },
    },
  },
);
