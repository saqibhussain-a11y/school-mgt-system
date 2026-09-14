import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import type { LlmMessage, LlmProvider } from "./types";

// Groq speaks the same wire format OpenAI does (chat/completions), just
// against its own free, fast-inference endpoint — see openai.ts for the
// near-identical twin of this file.
export const groqProvider: LlmProvider = {
  name: "groq",

  async chat(messages: LlmMessage[]): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: env.groqModel, messages }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpError(502, `Groq API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new HttpError(502, "Groq API returned no content");
    return content;
  },
};
