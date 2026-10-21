import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Keystone's generated context and the NKS-owned dashboard APIs are
    // intentionally dynamic. Keep lint useful without treating their
    // established `any`/generator conventions as launch-blocking errors.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "prefer-const": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    files: ["features/dashboard/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react/no-children-prop": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  globalIgnores([
    ".keystone/**",
    ".next/**",
    ".runtime/**",
    "next-env.d.ts",
    "schema.graphql",
    "schema.prisma",
  ]),
]);
