import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import type { LlmMessage, LlmProvider } from "./types";

const MAX_TOKENS = 1024;
const ANTHROPIC_VERSION = "2023-06-01";

// Anthropic's Messages API wants the system prompt as a separate top-level
// field too (like Gemini), and requires max_tokens explicitly — there's no
// server-side default to fall back on.
export const anthropicProvider: LlmProvider = {
  name: "anthropic",

  async chat(messages: LlmMessage[]): Promise<string> {
    const systemText = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.anthropicApiKey ?? "",
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.anthropicModel,
        max_tokens: MAX_TOKENS,
        ...(systemText ? { system: systemText } : {}),
        messages: conversation,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpError(502, `Anthropic API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const content = data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    if (!content) throw new HttpError(502, "Anthropic API returned no content");
    return content;
  },
};
