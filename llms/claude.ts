import { LLMProvider } from "@makemy/llms/base.ts";

export class ClaudeProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();
    return data.content[0].text;
  }
}
