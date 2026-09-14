// One shape every adapter speaks, regardless of how different the actual
// provider's wire format is underneath (OpenAI-style messages array vs.
// Gemini's contents/parts vs. Anthropic's separate system field). Feature
// code (report summaries, the chatbot) is written against this interface
// only — swapping providers later never touches feature code.
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(messages: LlmMessage[]): Promise<string>;
}
