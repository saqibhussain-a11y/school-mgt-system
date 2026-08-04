import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { currentTenantSchoolId } from "./tenantContext";

// School is the tenant root — it has no schoolId column, so it's the only
// model this extension leaves untouched. Every other model in the schema
// gets schoolId merged in automatically, on top of (not instead of) each
// service's own explicit `where: { schoolId, ... }` — this is a safety net
// for the class of bug an audit found (a forgotten schoolId filter), not a
// replacement for the service layer's own scoping. Raw $queryRaw/$executeRaw
// calls bypass this entirely (none exist in this codebase today).
const TENANT_EXEMPT_MODELS: ReadonlySet<Prisma.ModelName> = new Set(["School"]);

const WHERE_SCOPED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

function withTenantScoping(client: PrismaClient) {
  return client.$extends({
    name: "tenant-scoping",
    query: {
      $allModels: {
        // `args` is a union across every model's operation-specific input
        // type — merging schoolId generically across that union isn't
        // something the type system can express, so this operates on `any`
        // and relies on the runtime operation-name check for correctness.
        async $allOperations({ model, operation, args, query }: any) {
          const schoolId = currentTenantSchoolId();
          if (!schoolId || !model || TENANT_EXEMPT_MODELS.has(model as Prisma.ModelName)) {
            return query(args);
          }

          if (WHERE_SCOPED_OPERATIONS.has(operation)) {
            args.where = { ...(args.where ?? {}), schoolId };
          } else if (operation === "create") {
            args.data = { ...(args.data ?? {}), schoolId };
          } else if (operation === "createMany" && Array.isArray(args.data)) {
            args.data = args.data.map((row: Record<string, unknown>) => ({ ...row, schoolId }));
          } else if (operation === "upsert") {
            args.where = { ...(args.where ?? {}), schoolId };
            args.create = { ...(args.create ?? {}), schoolId };
          }

          return query(args);
        },
      },
    },
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __smsPrisma: ReturnType<typeof createPrismaClient> | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return withTenantScoping(new PrismaClient({ adapter }));
}

export const prisma = globalThis.__smsPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__smsPrisma = prisma;
}

// The extended client's $transaction callback type no longer matches the
// base Prisma.TransactionClient — services that type their `tx` param
// explicitly should use this instead (derived from the real client, so it
// always matches whatever $transaction actually hands back).
type ExtractTransactionClient<T> = T extends {
  $transaction(fn: (tx: infer X) => unknown, ...rest: never[]): unknown;
}
  ? X
  : never;
export type PrismaTransactionClient = ExtractTransactionClient<typeof prisma>;
