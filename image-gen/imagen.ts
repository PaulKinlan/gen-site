import { ImageGenerationProvider } from "@makemy/image-gen/base.ts";
import { ImageGenerationContext } from "@makemy/types.ts";
import { decodeBase64 } from "@std/encoding";

const IMAGE_MODEL = "imagen-4.0-generate-001";

export class ImaGenProvider implements ImageGenerationProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  }

  async generateImage(
    context: ImageGenerationContext
  ): Promise<ReadableStream> {
    const promptText = `${context.prompt}${
      context.style ? `. Style: ${context.style}` : ""
    }`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt: promptText }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Imagen image generation failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64) {
      throw new Error("Imagen image generation failed: no image data in response");
    }

    const bytes = decodeBase64(base64);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
}
