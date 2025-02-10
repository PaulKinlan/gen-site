import { ImageGenerationProvider } from "@makemy/image-gen/base.ts";
import { ImageGenerationContext } from "@makemy/types.ts";

export class ImaGenProvider implements ImageGenerationProvider {
  async generateImage(context: ImageGenerationContext): Promise<string> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${IMAGE_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate an image matching this description: ${
                      context.prompt
                    }${
                      context.style ? `. Style: ${context.style}` : ""
                    }. The image should be ${context.width}x${
                      context.height
                    } pixels.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate image: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        throw new Error("No image data in response");
      }

      return data.candidates[0].content.parts[0].inlineData.data;
    } catch (error) {
      console.error("Image generation failed:", error);
      throw new Error("image generation", "Imagen");
    }
  }
}
