import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This app's dominant data-fetching pattern is a shared `useApi` hook
      // (lib/use-api.ts) that fetches on mount inside a `useEffect` — a
      // completely standard, correct pattern used across ~45 components.
      // eslint-plugin-react-hooks v7's react-compiler-oriented rule flags
      // it as an error regardless of the setState call being inside an
      // async .then()/.catch()/.finally(), not literally synchronous in the
      // effect body. Downgraded to a warning rather than rewritten across
      // every call site — that would be a real refactor, not a lint fix.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
