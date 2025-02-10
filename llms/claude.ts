import { LLMInput, LLMProvider } from "@makemy/llms/base.ts";

type Message = {
  role: string;
  content: string;
  cache_control?: { type: string };
};

type SystemMessage = {
  type: string;
  text: string;
  cache_control?: { type: string };
};

export class ClaudeProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  }

  async generate(prompt: LLMInput): Promise<string> {
    const system: SystemMessage[] = prompt.system.map((p) => {
      return { type: "text", text: p, cache_control: { type: "ephemeral" } };
    });

    system.push({
      type: "text",
      text: "Context from previous requests:\n",
    });

    system.push(
      ...prompt.files.map((f) => {
        return { type: "text", text: f, cache_control: { type: "ephemeral" } };
      })
    );

    system.push({
      type: "text",
      text: "Imported context for @url references:\n",
    });

    system.push(
      ...prompt.context.map((c) => {
        return { type: "text", text: c, cache_control: { type: "ephemeral" } };
      })
    );

    console.log(system);

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
        system: system,
        messages: [
          {
            role: "user",
            content: prompt.prompt,
          },
        ],
      }),
    });

    const data = await response.json();
    console.log(data);
    return data.content[0].text;
  }
}
