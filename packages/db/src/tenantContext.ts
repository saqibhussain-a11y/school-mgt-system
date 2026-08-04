import { AsyncLocalStorage } from "node:async_hooks";

// null = explicitly running as a platform-level operation (cross-tenant,
// e.g. school provisioning) — see runAsPlatform. undefined (never entered
// any run()) happens outside a request (scripts, seed, tests) and is
// treated the same as null: no auto-scoping applied.
const storage = new AsyncLocalStorage<string | null>();

export function runWithTenant<T>(schoolId: string, fn: () => T): T {
  return storage.run(schoolId, fn);
}

export function runAsPlatform<T>(fn: () => T): T {
  return storage.run(null, fn);
}

export function currentTenantSchoolId(): string | null {
  const store = storage.getStore();
  return store === undefined ? null : store;
}
