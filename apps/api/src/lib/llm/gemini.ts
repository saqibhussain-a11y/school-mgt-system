import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import type { LlmMessage, LlmProvider } from "./types";

// Gemini's wire format differs from the OpenAI-style messages array in two
// ways: system prompts are a separate top-level field, not a message with
// role "system", and the assistant's own role is called "model" instead of
// "assistant". This adapter is where that translation happens — feature
// code never sees it.
export const geminiProvider: LlmProvider = {
  name: "gemini",

  async chat(messages: LlmMessage[]): Promise<string> {
    const systemText = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpError(502, `Gemini API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!content) throw new HttpError(502, "Gemini API returned no content");
    return content;
  },
};
