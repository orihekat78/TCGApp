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
);
