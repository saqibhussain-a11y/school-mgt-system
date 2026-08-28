import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { currentTenantSchoolId } from "./tenantContext";

const TENANT_EXEMPT_MODELS: ReadonlySet<Prisma.ModelName> = new Set([
  "School",
  "PlatformAdmin",
  "PlatformRefreshToken",
]);

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
  var __smsPrisma: ReturnType<typeof createPrismaClient> | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    },
    {
      onPoolError: (err) => console.error("[prisma] pool error", err),
      onConnectionError: (err) => console.error("[prisma] connection error", err),
    },
  );
  return withTenantScoping(new PrismaClient({ adapter }));
}

export const prisma = globalThis.__smsPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__smsPrisma = prisma;
}

type ExtractTransactionClient<T> = T extends {
  $transaction(fn: (tx: infer X) => unknown, ...rest: never[]): unknown;
}
  ? X
  : never;
export type PrismaTransactionClient = ExtractTransactionClient<typeof prisma>;
