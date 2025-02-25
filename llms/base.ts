import { SupportedContentType } from "@makemy/types.ts";
export type LLMImage = {
  type: "base64";
  media_type: string;
  data: string;
};

export type LLMInput = {
  contentType: Exclude<SupportedContentType, "image" | "media">;
  system: string[];
  files: string[]; // The files that are being referenced
  context: string[]; // The context that is being imported (i.e, @url)
  prompt: string;
  images?: LLMImage[]; // Images to include in the prompt
};

export interface LLMProvider {
  generate(prompt: LLMInput): Promise<ReadableStream>;
}

export type SupportedLLMProvider = "claude" | "gemini" | "groq" | "openai";

export class UnsupportedOperationError extends Error {
  constructor(operation: string, provider: string) {
    super(`Operation ${operation} is not supported by provider ${provider}`);
  }
}
