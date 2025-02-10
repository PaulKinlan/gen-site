import {
  ImageGenerationProvider,
  SupportedImageGenerationProvider,
} from "@makemy/image-gen/base.ts";
import { ImaGenProvider } from "./imagen.ts";
import { ReplicateProvider } from "@makemy/image-gen/replicate.ts";
export function createImageGenerationProvider(): ImageGenerationProvider {
  const provider = Deno.env.get(
    "IMAGE_GEN_PROVIDER"
  ) as SupportedImageGenerationProvider;

  switch (provider) {
    case "imagen":
      return new ImaGenProvider();
    case "replicate":
    default:
      return new ReplicateProvider();
  }
}

// Singleton instance for use throughout the application
let llmInstance: ImageGenerationProvider | null = null;

export function getImageGenerationProvider(): ImageGenerationProvider {
  if (!llmInstance) {
    llmInstance = createImageGenerationProvider();
  }
  return llmInstance;
}
