import { ImageGenerationContext } from "@makemy/types.ts";

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
  generateImage?(context: ImageGenerationContext): Promise<string>;
  supportsImageGeneration?(): boolean;
}

export type SupportedLLMProvider = "claude" | "gemini" | "groq" | "openai";

export class UnsupportedOperationError extends Error {
  constructor(operation: string, provider: string) {
    super(`Operation ${operation} is not supported by provider ${provider}`);
  }
}
