import { LLMInput, LLMProvider, LLMImage } from "@makemy/llms/base.ts";
import Anthropic from "@anthropic-ai/sdk";
import { additionalPromptForContentType } from "@makemy/core/generate/site.ts";

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
    const content: ContentBlock[] = [];
    const system: SystemMessage[] = prompt.system.map((p) => {
      const cache_control =
        cacheControlCount <= 4 ? { type: "ephemeral" } : undefined;
      cacheControlCount++;
      return { type: "text", text: p };
    });

    if (system && system.length > 0) {
      system.at(-1).cache_control = { type: "ephemeral" };
    }

    system.push({
      type: "text",
      text: "Context from previous requests:\n<files>",
    });

    console.log("Files", prompt.files.length);
    console.log("Files", prompt.files);

    system.push(
      ...prompt.files.map((f) => {
        const cache_control =
          cacheControlCount < 4 ? { type: "ephemeral" } : undefined;
        cacheControlCount++;
        return { type: "text", text: f };
      })
    );

    system.push({ type: "text", text: "</files>" });

    system.push({
      type: "text",
      text: "Imported context for @url references:\n<contexts>",
    });

    system.push(
      ...prompt.context.map((c) => {
        const cache_control =
          cacheControlCount <= 4 ? { type: "ephemeral" } : undefined;
        cacheControlCount++;
        return { type: "text", text: c };
      })
    );

    system.push({ type: "text", text: "</contexts>" });

    const client = new Anthropic({ apiKey: this.apiKey });

    // console.log("System messages", system);
    // console.log("Images", prompt.images?.length);
    // console.log("Prompt", prompt.prompt);

    // Add images if present
    let imageCounter = 0;
    if (prompt.images && prompt.images.length > 0) {
      for (const img of prompt.images) {
        content.push({
          type: "text",
          text: `Image ${imageCounter++}: `,
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

    content.push({
      type: "text",
      text: `You MUST ALWAYS follow these rules:
${additionalPromptForContentType[prompt.contentType]}`,
    });
    // Add text prompt
    content.push({
      type: "text",
      text: prompt.prompt,
    });

    console.log("System messages", system);
    const stream = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: system.join("\n"),
      messages: [
        {
          role: "user",
          content,
        },
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "```" + prompt.contentType,
            },
          ],
        },
      ],
      stream: true,
    });

    const newStream = new ReadableStream({
      async start(controller) {
        console.log("Starting stream: Claude");
        // We use this because we are telling claude to output this, so it needs to be present.
        controller.enqueue("```" + prompt.contentType);

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            //console.log(event.delta.text);
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
