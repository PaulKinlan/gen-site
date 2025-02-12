import { ImageGenerationProvider } from "@makemy/image-gen/base.ts";
import { ImageGenerationContext } from "@makemy/types.ts";
import Replicate from "replicate";

import { decodeBase64 } from "@std/encoding";

import { Buffer } from "node:buffer";

const API_KEY = Deno.env.get("REPLICATE_API_KEY");
const MODEL = "google/imagen-3-fast";

export class ReplicateProvider implements ImageGenerationProvider {
  async generateImage(
    context: ImageGenerationContext
  ): Promise<ReadableStream> {
    const replicate = new Replicate({
      // get your token from https://replicate.com/account/api-tokens
      auth: API_KEY, // defaults to process.env.REPLICATE_API_TOKEN
    });

    const output = await replicate.run(MODEL, {
      input: {
        safety_filter_level: "block_only_high",
        aspect_ratio: `1:1`,
        prompt: context.prompt,
      },
    });

    return output;
  }
}
