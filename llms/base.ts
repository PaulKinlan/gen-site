export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

export type SupportedLLMProvider = "claude" | "gemini" | "groq" | "openai";
