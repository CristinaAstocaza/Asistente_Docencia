import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {files:["scripts/*.cjs"],rules:{"@typescript-eslint/no-require-imports":"off"}},
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-studio/**",
    ".next-preview/**",
    ".next-platform/**",
    ".next-platform-production/**",
    ".next-proxy/**",
    "public/vendor/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
