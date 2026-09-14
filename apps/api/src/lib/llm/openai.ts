import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import type { LlmMessage, LlmProvider } from "./types";

export const openaiProvider: LlmProvider = {
  name: "openai",

  async chat(messages: LlmMessage[]): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: env.openaiModel, messages }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpError(502, `OpenAI API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new HttpError(502, "OpenAI API returned no content");
    return content;
  },
};
