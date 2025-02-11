import { BaseHandler } from "@makemy/routes/base.ts";
import {
  Site,
  RequestContext,
  SupportedContentType,
  ImageGenerationContext,
  UnsupportedContentType,
} from "@makemy/types.ts";
import { UnsupportedOperationError, LLMInput } from "@makemy/llms/base.ts";
import { getLLMProvider } from "@makemy/llms/factory.ts";
import { db } from "@makemy/core/db.ts";
import { Cache } from "@makemy/core/cache.ts";
import {
  getContentType,
  isMediaFile,
  getMimeType,
} from "@makemy/utils/contentType.ts";
import { getSiteFromHostname } from "@makemy/utils/hostname.ts";
import { cache } from "@makemy/routes/decorators/cache.ts";
import { getImageGenerationProvider } from "@makemy/image-gen/factory.ts";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { CacheLine } from "@makemy/core/cache.ts";

const cacheInstance = new Cache();
// Initialize the cache immediately
cacheInstance.init().catch((e) => {
  console.error("Failed to initialize cache:", e);
  throw e;
});

async function processGeneratedImages(
  content: string,
  site: Site
): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const images = Array.from(doc.querySelectorAll("img[data-gen-image='true']"));

  console.log("Processing Images", images);

  for (const img of images) {
    try {
      const context: ImageGenerationContext = {
        prompt: img.getAttribute("data-context") || "",
        style: img.getAttribute("data-style") || undefined,
        width: parseInt(img.getAttribute("data-width") || "512", 10),
        height: parseInt(img.getAttribute("data-height") || "512", 10),
        alt: img.getAttribute("alt") || "",
        path: img.getAttribute("src") || "",
      };

      if (!context.prompt) {
        console.warn("Missing data-context for image generation");
        continue;
      }

      // Save the image information so it can be used later
      await db.addSiteImageInformation(site.subdomain, context);
    } catch (error) {
      if (error instanceof UnsupportedOperationError) {
        console.warn("Image generation not supported:", error.message);
        break;
      }
      console.error("Failed to generate image:", error);
    }
  }

  return doc.documentElement.outerHTML;
}

function extractContentFromMarkdown(
  text: string,
  contentType: SupportedContentType
): string {
  const codeBlockRegex = new RegExp(
    `\`\`\`${contentType}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
    "i"
  );
  const match = text.match(codeBlockRegex);

  if (!match) {
    console.log("\n=== Claude Response Analysis ===");
    console.log("Failed to find code block in response");
    console.log("Content Type:", contentType);
    console.log("Full Response:", text);
    throw new Error(`No ${contentType} code block found in the response`);
  }

  return match[1].trim();
}

const additionalPromptForContentType: Record<string, string> = {
  html: `+ Generate valid accessible HTML5 content
+ <meta name="generator" content="MakeMy.blog" />
+ Include semantic markup and ensure accessibility. 
+ Do not use inline CSS or <style> blocks, instead link to a CSS file with a descriptive name, e.g <link rel="stylesheet" href="/main.css">. Consider CSS from previous requests to enable consistent styling across the site.
+ Prefer not to use JavaScript in the HTML content. If you need to include JavaScript, link to an external file with a descriptive name.
+ For images that should be AI generated, use the following format:
  <img data-gen-image="true" 
       data-context="[description of the image to generate]" 
       data-style="[optional style: photo, illustration, watercolor, etc]"
       data-width="[optional width in pixels]"
       data-height="[optional height in pixels]"
       alt="[descriptive alt text]" 
       src="[descriptive-file-name-for-the-image]">`,
  css: "Generate clean, modern (e.g use flex-box and grid), responsive CSS (mobile, desktop and tablet). Include light and dark mode.",
  js: "Generate clean JavaScript code. Use modern ES6+ syntax. Ensure error handling and browser compatibility.",
};

// Direct image generation helper
async function generateDirectImage(
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

// Site generation helper
async function generateSiteContent(
  path: string,
  site: Site,
  context: RequestContext,
  contentType: SupportedContentType
): Promise<string> {
  const basePrompt = `You are an AI content generator that creates web content for the following site based on the context in the <prompt> tags.

  You will have access to the content of the previous requests in the <file> tags, with each <file> representing a different path on the site.

  You will also have access to the extracted context from the imported URLs in the <importedContext> tag, with each <context> representing a different URL that the user would you to reference.
  
  <prompt>
    ${site.prompt}
  </prompt>`;

  const previousRequestContext = context.previousRequests
    .filter((req) => isMediaFile(req.path) === false) // no media files.
    .map((req) => {
      return `\t<file name="${req.path}">\n${req.value.content}\n</file>`;
    });

  const importedContext = context.importedContext.map((ctx) => {
    return `\t<context name="@url ${ctx.url} "url="${ctx.url}">${ctx.markdown}</context>`;
  });

  const prompt: LLMInput = {
    system: [basePrompt],
    files: previousRequestContext,
    context: importedContext,
    prompt: `For the URL pathname '${path}' create a ${contentType} file that follows these rules: ' ${additionalPromptForContentType[contentType]}`,
  };

  const llmProvider = getLLMProvider();
  const response = await llmProvider.generate(prompt);
  let content = extractContentFromMarkdown(response, contentType);

  if (contentType === "html") {
    content = await processGeneratedImages(content, site);
  }

  return content;
}

class SubdomainHandler extends BaseHandler {
  @cache({ cache: cacheInstance })
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const hostname = url.hostname;
    const path = url.pathname;
    const contentType: SupportedContentType | UnsupportedContentType =
      getContentType(path);

    if (contentType == "unsupported") {
      console.log(`Unsupported content type: ${path}`);
      return new Response("Unsupported content type", { status: 400 });
    }

    // Check custom domain headers
    const servedForHeader = req.headers.get("X-Served-For");
    const saasDomainIp = req.headers.get("X-SaaS-Domains-IP");

    let site: Site | null = null;
    let siteId: string;

    if (servedForHeader) {
      // If served through custom domain proxy
      site = await db.getSiteByDomain(servedForHeader);
      siteId = servedForHeader;
    } else {
      // Regular subdomain access
      siteId = getSiteFromHostname(hostname);
      site = await db.getSite(siteId);
    }

    if (!site) return new Response("Site not found", { status: 404 });

    // Only block media files that aren't images we can generate
    if (isMediaFile(path) && contentType !== "image") {
      console.log(`Media files are not supported: ${path}`);
      return new Response("Media files are not supported", { status: 400 });
    }

    // Get previous requests for this site
    const previousRequestsOld: CacheLine[] =
      (await cacheInstance.getMatching(site.subdomain)) ?? [];

    const previousRequests: CacheLine[] = [];
    const cache = await caches.open(site.subdomain);
    for (const previousRequest of previousRequestsOld) {
      const urlToMatch = url;
      urlToMatch.pathname = previousRequest.path;
      const match = await cache.match(urlToMatch);
      const value = await match?.text();
      previousRequests.push({
        path: previousRequest.path,
        value: {
          content: value || "",
          timestamp: previousRequest.value.timestamp,
        },
      });
    }
    // const cache = await caches.open(site.subdomain);
    // const cachedRequests = await cache.matchAll();
    // for (const cachedRequest of cachedRequests) {
    //   const cacheLine: CacheLine = {
    //     path: cachedRequest.url,
    //     value: {
    //       content: await cachedRequest.text(),
    //       timestamp: Date.now(),
    //     },
    //   };

    //   previousRequests.push(cacheLine);
    // }

    // Get the extracted markdown for @url syntax
    const importedContext =
      (await db.getAllExtractedMarkdown(site.subdomain)) ?? [];

    let content: string | ReadableStream;
    if (contentType === "image") {
      //
      content = await generateDirectImage(path, site, {
        previousRequests,
        importedContext,
      });
    } else {
      content = await generateSiteContent(
        path,
        site,
        { previousRequests, importedContext },
        contentType
      );
    }

    const mimeType = getMimeType(path);
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": mimeType },
    });
  }
}

export default new SubdomainHandler();
