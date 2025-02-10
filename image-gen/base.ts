import { ImageGenerationContext } from "@makemy/types.ts";
import { Readable } from "node:stream";

export interface ImageGenerationProvider {
  generateImage(context: ImageGenerationContext): Promise<ReadableStream>;
}

export type SupportedImageGenerationProvider = "imagen" | "replicate";
