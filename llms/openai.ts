import { LLMInput, LLMProvider } from "@makemy/llms/base.ts";

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  }

  async generate(prompt: LLMInput): Promise<string> {
    const messages = prompt.system.map((p) => {
      return { role: "user", content: p };
    });
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
