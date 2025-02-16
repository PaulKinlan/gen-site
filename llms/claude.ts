import { LLMInput, LLMProvider, LLMImage } from "@makemy/llms/base.ts";
import Anthropic from "@anthropic-ai/sdk";

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type ImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: MediaType;
    data: string;
  };
};

type TextBlock = {
  type: "text";
  text: string;
};

type ContentBlock = TextBlock | ImageBlock;

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

  async generate(prompt: LLMInput): Promise<ReadableStream> {
    let cacheControlCount = 0;
    const system: SystemMessage[] = prompt.system.map((p) => {
      const cache_control =
        cacheControlCount <= 4 ? { type: "ephemeral" } : undefined;
      cacheControlCount++;
      return { type: "text", text: p };
    });

    // Add images if present
    let imageCounter = 0;
    if (prompt.images && prompt.images.length > 0) {
      for (const img of prompt.images) {
        content.push({
          type: "text",
          text: `Image ${imageCounter++}`,
        });

        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.media_type as MediaType,
            data: img.data,
          },
        });
      }
    }

    system.push({
      type: "text",
      text: "Context from previous requests:\n",
    });

    system.push(
      ...prompt.files.map((f) => {
        const cache_control =
          cacheControlCount < 4 ? { type: "ephemeral" } : undefined;
        cacheControlCount++;
        return { type: "text", text: f };
      })
    );

    system.push({
      type: "text",
      text: "Imported context for @url references:\n",
    });

    system.push(
      ...prompt.context.map((c) => {
        const cache_control =
          cacheControlCount <= 4 ? { type: "ephemeral" } : undefined;
        cacheControlCount++;
        return { type: "text", text: c };
      })
    );

    const client = new Anthropic({ apiKey: this.apiKey });

    console.log("System messages", system);
    console.log("Prompt", prompt.prompt);

    const content: ContentBlock[] = [];

    // Add text prompt
    content.push({
      type: "text",
      text: prompt.prompt,
    });

    const stream = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      system: system.join("\n"),
      messages: [
        {
          role: "user",
          content,
        },
      ],
      stream: true,
    });

    const newStream = new ReadableStream({
      async start(controller) {
        console.log("Starting stream: Claude");
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(event.delta.text);
          } else if (event.type === "message_stop") {
            controller.close();
          }
        }

        controller.close();
      },
    });

    return newStream;
  }
}
