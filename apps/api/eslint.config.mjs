import tseslint from "typescript-eslint";

// Non-type-aware recommended rules only, deliberately — the goal here is
// making `npm run lint` work at all (it was a hard failure with zero config
// before this), not retroactively fixing every pre-existing violation
// type-aware linting would surface across the whole codebase in one pass.
export default tseslint.config(
  { ignores: ["dist/**", "uploads/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
