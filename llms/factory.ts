import { LLMProvider, SupportedLLMProvider } from "@makemy/llms/base.ts";
import { ClaudeProvider } from "@makemy/llms/claude.ts";
import { GeminiProvider } from "@makemy/llms/gemini.ts";
import { GroqProvider } from "@makemy/llms/groq.ts";
import { OpenAIProvider } from "@makemy/llms/openai.ts";

export function createLLMProvider(): LLMProvider {
  const provider = Deno.env.get("LLM_PROVIDER") as SupportedLLMProvider;

  switch (provider) {
    case "gemini":
      return new GeminiProvider();
    case "groq":
      return new GroqProvider();
    case "openai":
      return new OpenAIProvider();
    case "claude":
    default:
      return new ClaudeProvider();
  }
}

// Singleton instance for use throughout the application
let llmInstance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!llmInstance) {
    llmInstance = createLLMProvider();
  }
  return llmInstance;
}
