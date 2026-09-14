import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtPlatformAccessSecret: required("JWT_PLATFORM_ACCESS_SECRET"),
  jwtPlatformRefreshSecret: required("JWT_PLATFORM_REFRESH_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Which LLM_PROVIDER key below is actually active — everything AI-backed
  // (report summaries, the chatbot) is disabled until this is set, the same
  // "optional, degrades gracefully" pattern as Stripe above. One of "groq" |
  // "gemini" | "anthropic" | "openai" | "ollama" — see lib/llm/index.ts.
  // Model defaults below are a best-effort snapshot, not a guarantee —
  // provider catalogs change; override via env if a default 404s.
  llmProvider: process.env.LLM_PROVIDER,
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  // No API key — a fully free, self-hosted model. Only "available" if
  // something is actually listening at this URL.
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1",
};
