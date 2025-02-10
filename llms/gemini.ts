import {
  LLMInput,
  LLMProvider,
  UnsupportedOperationError,
} from "@makemy/llms/base.ts";
import { ImageGenerationContext } from "@makemy/types.ts";

const TEXT_MODEL = "gemini-2.0-flash";
const IMAGE_MODEL = "gemini-pro-vision";
export class GeminiProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  }

  async generate(prompt: LLMInput): Promise<string> {
    const parts = prompt.system.map((p) => {
      return { text: p };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${TEXT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts,
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}
