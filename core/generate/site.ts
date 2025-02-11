import { db } from "@makemy/core/db.ts";
import { LLMInput, UnsupportedOperationError } from "@makemy/llms/base.ts";
import { getLLMProvider } from "@makemy/llms/factory.ts";
import {
  ImageGenerationContext,
  RequestContext,
  Site,
  SupportedContentType,
} from "@makemy/types.ts";
import { isMediaFile } from "@makemy/utils/contentType.ts";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
// Site generation helper

export const additionalPromptForContentType: Record<string, string> = {
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

export async function generateSiteContent(
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
