import { ImageGenerationProvider } from "@makemy/image-gen/base.ts";
import { ImageGenerationContext } from "@makemy/types.ts";
import { decodeBase64 } from "@std/encoding";

const IMAGE_MODEL = "imagen-4.0-generate-001";

// Imagen only accepts a fixed set of aspect ratios; pick the closest one.
const SUPPORTED_ASPECT_RATIOS: ReadonlyArray<[string, number]> = [
  ["1:1", 1],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
];

function nearestAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return "1:1";
  const target = width / height;
  let best = SUPPORTED_ASPECT_RATIOS[0];
  for (const candidate of SUPPORTED_ASPECT_RATIOS) {
    if (Math.abs(candidate[1] - target) < Math.abs(best[1] - target)) {
      best = candidate;
    }
  }
  return best[0];
}

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
            aspectRatio: nearestAspectRatio(context.width, context.height),
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
