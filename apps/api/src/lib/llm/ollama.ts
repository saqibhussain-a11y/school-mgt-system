import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import type { LlmMessage, LlmProvider } from "./types";

// Fully free, self-hosted — no API key, just whatever's running locally
// (`ollama pull llama3.1 && ollama serve`). Its /api/chat endpoint already
// accepts the same role/content message shape our interface uses, so this
// is the one adapter with no translation to do.
export const ollamaProvider: LlmProvider = {
  name: "ollama",

  async chat(messages: LlmMessage[]): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.ollamaModel, messages, stream: false }),
      });
    } catch {
      throw new HttpError(
        502,
        `Could not reach Ollama at ${env.ollamaBaseUrl} — is \`ollama serve\` running?`,
      );
    }

    if (!res.ok) {
      const body = await res.text();
      throw new HttpError(502, `Ollama error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    if (!content) throw new HttpError(502, "Ollama returned no content");
    return content;
  },
};
