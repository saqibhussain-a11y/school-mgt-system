import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import type { LlmProvider } from "./types";
import { groqProvider } from "./groq";
import { geminiProvider } from "./gemini";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { ollamaProvider } from "./ollama";

export type { LlmMessage, LlmProvider } from "./types";

// Each factory returns null when its own API key isn't set, so a provider
// only "counts" as available once it's actually usable — mirrors
// getStripeClient()'s optional-until-configured pattern. Ollama is the one
// exception: no key to check, so it's "available" whether or not anything
// is actually listening (chat() below finds out for real).
const PROVIDERS: Record<string, () => LlmProvider | null> = {
  groq: () => (env.groqApiKey ? groqProvider : null),
  gemini: () => (env.geminiApiKey ? geminiProvider : null),
  anthropic: () => (env.anthropicApiKey ? anthropicProvider : null),
  openai: () => (env.openaiApiKey ? openaiProvider : null),
  ollama: () => ollamaProvider,
};

// The one function AI-backed features (report summaries, the chatbot) call
// — they ask for "the configured provider" and never know or care which of
// the five actually answers. Throws a clear, actionable error instead of
// letting a feature silently no-op when nothing is configured yet.
export function getLlmProvider(): LlmProvider {
  const selected = env.llmProvider;
  if (!selected) {
    throw new HttpError(
      501,
      "No AI provider is configured — set LLM_PROVIDER (groq | gemini | anthropic | openai | ollama) and its API key",
    );
  }
  const factory = PROVIDERS[selected];
  if (!factory) {
    throw new HttpError(500, `LLM_PROVIDER is set to "${selected}", which isn't one of: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  const provider = factory();
  if (!provider) {
    throw new HttpError(501, `LLM_PROVIDER is "${selected}" but its API key is not configured`);
  }
  return provider;
}
