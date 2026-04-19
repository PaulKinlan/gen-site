import { LLMInput, LLMProvider } from "@makemy/llms/base.ts";

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  }

  async generate(prompt: LLMInput): Promise<ReadableStream> {
    const messages: { role: string; content: string }[] = prompt.system.map(
      (p) => {
        return { role: "system", content: p };
      }
    );

    messages.push({ role: "user", content: prompt.prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    const text: string = data.choices[0].message.content;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    });
  }
}
