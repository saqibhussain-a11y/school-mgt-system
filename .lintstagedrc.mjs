// Re-lints the whole affected workspace rather than passing individual
// staged file paths through to eslint — simpler and avoids any ambiguity
// with ESLint v9 flat-config resolution across a monorepo with two
// separate eslint.config.mjs files (apps/api, apps/web). Both lint
// commands run in a couple of seconds, so the coarser scope is a fine
// trade for a pre-commit hook.
export default {
  "apps/api/**/*.{ts,tsx}": () => "npm run lint -w apps/api",
  "apps/web/**/*.{ts,tsx}": () => "npm run lint -w apps/web",
};
