import { execSync } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { testDatabaseUrl } from "./testDatabase";

export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const database = decodeURIComponent(url.pathname.slice(1));

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }

  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, "../../../../packages/db"),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });
}
