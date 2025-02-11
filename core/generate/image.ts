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

  // Extract image parameters from path
  // Example: /images/hero-watercolor-800x600.png -> style: watercolor, width: 800, height: 600
  const pathParts = path.split("/");
  const filename = pathParts[pathParts.length - 1];
  const [name, ...params] = filename.split(".")[0].split("-");

  // Parse dimensions if provided (last parameter should be WxH)
  let width = 512;
  let height = 512;
  let style: string | undefined;

  if (params.length > 0) {
    const lastParam = params[params.length - 1];
    if (lastParam.includes("x")) {
      const [w, h] = lastParam.split("x").map((n) => parseInt(n, 10));
      if (!isNaN(w) && !isNaN(h)) {
        width = w;
        height = h;
        params.pop(); // Remove dimensions from params
      }
    }
    // Any remaining params are considered style
    if (params.length > 0) {
      style = params.join(" ");
    }
  }

  // Use the site's prompt and path context to generate a relevant image
  const imageContext: ImageGenerationContext = await db.getSiteImageInformation(
    site.subdomain,
    path
  );
  const imageData = await llmProvider.generateImage(imageContext);
  if (!imageData) {
    throw new Error("Failed to generate image");
  }

  return imageData;
}
