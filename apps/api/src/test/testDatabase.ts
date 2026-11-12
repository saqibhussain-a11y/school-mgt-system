import "dotenv/config";

// Local test runs use their own database (e.g. sms_dev_test) so the fixture
// schools they create never show up in the app. CI already points
// DATABASE_URL at a throwaway database, so it's used as-is there.
export function testDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL must be set to run the API tests");
  if (process.env.CI) return raw;
  const url = new URL(raw);
  if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
  return url.toString();
}
