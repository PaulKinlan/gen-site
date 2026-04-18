import { LLMInput, LLMProvider } from "@makemy/llms/base.ts";

const TEXT_MODEL = "gemini-2.5-flash";
export class GeminiProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  }

  async generate(prompt: LLMInput): Promise<ReadableStream> {
    const parts = prompt.system.map((p) => {
      return { text: p };
    });

    parts.push({ text: prompt.prompt });

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
    const text: string = data.candidates[0].content.parts[0].text;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    });
  }
}
