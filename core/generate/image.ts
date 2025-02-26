import { db } from "@makemy/core/db.ts";
import { getImageGenerationProvider } from "@makemy/image-gen/factory.ts";
import { ImageGenerationContext, RequestContext, Site } from "@makemy/types.ts";

// Direct image generation helper

export async function generateDirectImage(
  path: string,
  site: Site,
  context: RequestContext
): Promise<ReadableStream> {
  const llmProvider = getImageGenerationProvider();

  // Use the site's prompt and path context to generate a relevant image
  console.log(site.subdomain, path);
  const imageContext = await db.getSiteImageInformation(
    site.subdomain,
    "/" + path
  );

  if (!imageContext) {
    throw new Error(`No image context found for path: ${path}`);
  }

  console.log(site.subdomain, path);
  console.log("Image context", imageContext);

  const imageData = await llmProvider.generateImage(imageContext);
  if (!imageData) {
    throw new Error("Failed to generate image");
  }

  return imageData;
}
