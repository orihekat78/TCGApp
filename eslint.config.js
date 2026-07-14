import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// ESLint v9+ flat config. Lints TypeScript/TSX sources only (matches the
// project's previous `--ext .ts,.tsx` intent). Type-aware rules are not
// enabled to keep linting fast and independent of the multiple tsconfigs.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".claude/**",
      ".obsidian/**",
      ".superpowers/**",
      "design-mockups/**",
      "design-mockups_v2/**",
      "user_request/**",
      // Archived workflow snapshots include intentionally incomplete snippets.
      "scripts/_archive/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // React hooks rules are advisory here: the project's imperative `run*Flow`
      // helpers (src/ui/hooks/useActionsPanelFlow.ts) call Zustand store
      // accessors named `use*` outside render, which rules-of-hooks flags as
      // false positives. Kept as warnings so the plugin's rules stay defined
      // (honoring existing `eslint-disable react-hooks/*` directives) without
      // failing the build on an intentional architecture.
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // Align with tsc's noUnusedParameters convention: `_`-prefixed names are
      // intentionally unused and must not be flagged.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Test fixtures intentionally use dynamic loading and partial values to
    // exercise runtime boundaries. These source-oriented rules do not apply
    // to the legacy test fixture boundary.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-useless-assignment": "off",
      "no-constant-condition": "off",
      "no-empty": "off",
    },
  },
  {
    // Printed card titles preserve full-width spacing from the source text.
    files: ["src/cards/ct-p03/B03136.ts", "src/cards/ct-p07/B07054.ts"],
    rules: { "no-irregular-whitespace": "off" },
  },
  {
    // These are imperative store/action helpers, not React Hooks. Their
    // established `use*` API names otherwise create false hook violations.
    files: [
      "src/engine/flow/main/ability-activate.ts",
      "src/main.tsx",
      "src/ui/components/Playmat.tsx",
      "src/ui/hooks/useActionsPanelFlow/flows.ts",
    ],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
);
