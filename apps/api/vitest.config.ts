import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Real Postgres integration tests (see src/test/helpers.ts) need
    // DATABASE_URL etc. loaded before any test file imports @sms/db — the
    // app itself only does this via src/config/env.ts's `dotenv/config`
    // import, which a test importing a service directly never touches.
    // Without this, Prisma silently falls back to libpq defaults (the OS
    // username as both user and database) instead of failing loudly.
    setupFiles: ["dotenv/config"],
  },
});
