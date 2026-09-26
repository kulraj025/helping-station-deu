import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * ESLint flat config.
 *
 * `next lint` is deprecated in Next 15 and removed in 16, so the project runs
 * the ESLint CLI directly against the same rule sets Next ships:
 * `next/core-web-vitals` plus `next/typescript`.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "scripts/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The codebase is deliberately explicit about server-only boundaries;
      // an accidental `any` in a public payload is worth failing on.
      "@typescript-eslint/no-explicit-any": "error",
      // Unused arguments are a signal, not noise, but `_`-prefixed params are
      // the convention for "required by the signature, deliberately unused"
      // (server actions receive `_previous`).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "**/*.test.ts"],
    rules: {
      // Tests deliberately feed invalid values into validators.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
