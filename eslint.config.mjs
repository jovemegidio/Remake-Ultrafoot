import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".qa-chrome-profile/**",
      ".local-backup*/**",
      "out/**",
      "node_modules/**",
      "backup/**",
      "Remake VIII/**",
      "Remake X/**",
      "BF2026-27/**",
      "src-tauri/**",
      "public/**",
      "music/**",
      "*.config.*",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-irregular-whitespace": "off",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "no-case-declarations": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
)
