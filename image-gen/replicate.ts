import { ImageGenerationProvider } from "@makemy/image-gen/base.ts";
import { ImageGenerationContext } from "@makemy/types.ts";
import Replicate from "replicate";

import { decodeBase64 } from "@std/encoding";

import { Buffer } from "node:buffer";

const API_KEY = Deno.env.get("REPLICATE_API_KEY");
const MODEL = "google/imagen-3-fast";

/**
 * Converts an EventSource stream into a ReadableStream.
 *
 * @param url The URL of the EventSource.
 * @param options Optional EventSource and ReadableStream options.
 * @returns A ReadableStream of text chunks received from the EventSource.
 * @throws {TypeError} If the input URL is invalid.
 */
function eventStreamToReadableStream(url: string): ReadableStream<string> {
  if (typeof url !== "string") {
    throw new TypeError("URL must be a string");
  }

  return new ReadableStream<string>({
    async start(controller) {
      const source = new EventSource(url, {
        withCredentials: true,
      });

      const entireFile: string[] = [];

      source.addEventListener("output", (e) => {
        console.log(e);
        if (e.type == "output") {
          const data = e.data.replace("data:image/jpeg;base64,", "");
          entireFile.push(data);
        }
      });

      source.addEventListener("error", (e) => {
        controller.error(new Error("EventSource error"));
      });

      source.addEventListener("done", (e) => {
        source.close();
        //console.log("done", JSON.parse(e.data));
        const decoded = Buffer.from(entireFile.join(""), "base64");

        controller.enqueue(new Uint8Array(decoded));

        controller.close();
      });

      // const streamResponse = await fetch(url, {
      //   headers: {
      //     Authorization: `Bearer ${API_KEY}`,
      //     Accept: "text/event-stream",
      //   },
      // });

      // if (!streamResponse.ok) {
      //   throw new Error(`Failed to fetch stream: ${streamResponse.statusText}`);
      // }

      // if (streamResponse.body === null) {
      //   throw new Error("Stream body is null");
      // }

      // const stream = streamResponse.body.pipeThrough(new TextDecoderStream());

      // console.log("Stream started");

      // const reader = stream.getReader();
      // while (true) {
      //   const { done, value } = await reader.read();
      //   controller.enqueue(value);
      //   if (done) break;
      // }
    },

    async pull(controller) {
      //  See explanation in the JS version.
    },

    async cancel(reason) {},
  });
}

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
