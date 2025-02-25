import { db } from "@makemy/core/db.ts";
import { LLMInput } from "@makemy/llms/base.ts";
import { getLLMProvider } from "@makemy/llms/factory.ts";
import {
  ImageGenerationContext,
  RequestContext,
  Site,
  SupportedContentType,
} from "@makemy/types.ts";
import { StorageService } from "@makemy/core/storage.ts";
import { isMediaFile } from "@makemy/utils/contentType.ts";
import * as htmlparser2 from "@victr/htmlparser2";
import { encodeBase64 } from "@std/encoding";
import { escape } from "@std/html/entities";

export const additionalPromptForContentType: Record<string, string> = {
  html: `+ Generate valid accessible semantic HTML5 markup
+ <meta name="generator" content="MakeMy.blog" />
+ Use the attached images to guide your layout and design choices.
+ You MAY use inline CSS and <style> blocks, but you must keep all the pages consistent.
+ You SHOULD prefer to link to a CSS file with a descriptive name, e.g <link rel="stylesheet" href="/main.css">. Consider CSS from previous requests to enable consistent styling across the site.
+ You SHOULD prefer not to use JavaScript in the HTML content. If you need to include JavaScript, link to an external file with a descriptive name.
+ For images that the user asks you to generate use the following format:
  \`<img data-gen-image="true" 
       data-context="[description of the image to generate]" 
       data-style="[optional style: photo, illustration, watercolor, etc]"
       data-width="[optional width in pixels]"
       data-height="[optional height in pixels]"
       alt="[descriptive alt text]" 
       src="[descriptive-file-name-for-the-image]">\``,
  css: "Generate clean, modern (e.g use flex-box and grid), responsive CSS (mobile, desktop and tablet). Include light and dark mode. Use the uploaded images as color inspiration, layout design that is suitable for the provided HTML.",
  js: "Generate clean JavaScript code. Use modern ES6+ syntax. Ensure error handling and browser compatibility.",
};

function parseHtmlStreamForGeneratedImages(site: Site): TransformStream {
  const parser = new htmlparser2.Parser({
    onopentag: (name: string, attributes: Record<string, string>) => {
      if (name === "img" && attributes["data-gen-image"] === "true") {
        // Validate required attributes.  Error if missing.
        const context = attributes["data-context"];
        const alt = attributes["alt"];
        const src = attributes["src"];

        if (!context || !alt || !src) {
          console.warn(
            "Skipping image: Missing required attributes (data-context, alt, or src).",
            attributes
          );
          return; // Skip this image.
        }

        const image: ImageGenerationContext = {
          prompt: context,
          alt,
          path: src,
        };

        // Optional attributes
        if (attributes["data-style"]) {
          image.style = attributes["data-style"];
        }
        if (attributes["data-width"]) {
          const width = parseInt(attributes["data-width"], 10);
          if (!isNaN(width)) {
            // Check for valid integer
            image.width = width;
          } else {
            console.warn("Invalid data-width:", attributes["data-width"]);
          }
        }
        if (attributes["data-height"]) {
          const height = parseInt(attributes["data-height"], 10);
          if (!isNaN(height)) {
            image.height = height;
          } else {
            console.warn("Invalid data-height:", attributes["data-height"]);
          }
        }

        console.log("Adding image to site", site, image);
        // It's really a promise here. This might fail.
        db.addSiteImageInformation(site.subdomain, image);
      }
    },
    onerror: (error: Error) => {
      console.error("Parser error:", error);
    },
  });
  const decoder = new TextDecoder();

  return new TransformStream({
    transform(chunk, controller) {
      // We are sending to the find the images.
      controller.enqueue(chunk);
      const chunkText = decoder.decode(chunk, { stream: true });
      parser.write(chunkText);
    },
  });
}

function extractCodeBlocksTS(
  contentType: SupportedContentType
): TransformStream {
  let buffer = "";
  let inCodeBlock = false;
  return new TransformStream({
    transform(chunk, controller) {
      const done = false;

      if (done) {
        if (inCodeBlock) {
          controller.enqueue(new TextEncoder().encode(buffer));
        }
      }

      buffer += chunk;

      let startIndex = 0;

      if (inCodeBlock == false) {
        if (
          (startIndex = buffer.indexOf("```" + contentType, startIndex)) !== -1
        ) {
          inCodeBlock = true;
          controller.enqueue(
            new TextEncoder().encode(
              buffer.substring(startIndex + 3 + contentType.length)
            )
          );
          buffer = "";
          startIndex = 0;
        }
      } else {
        // We are in a code block, we are looking for the end of the code block
        let endIndex = buffer.indexOf("```");
        if (endIndex !== -1) {
          console.log("END END END");
          // We found the end of the code block
          inCodeBlock = false;
          controller.enqueue(
            new TextEncoder().encode(buffer.substring(0, endIndex))
          ); // Don't go past endIndex
          // Because we are only managing one code block we can return;
          controller.terminate();
          return;
        }
        // Yield all the text
        controller.enqueue(
          new TextEncoder().encode(buffer.substring(startIndex))
        );
        buffer = "";
      }
    },
  });
}

export async function generateSiteContent(
  path: string,
  site: Site,
  context: RequestContext,
  contentType: Exclude<SupportedContentType, "image" | "media">
): Promise<ReadableStream> {
  const system = `You are an expert web developer that creates unique beautiful, fast, accessible web sites. 

This service takes a user-defined <prompt> and generates a site for them.

When creating an ${contentType.toLocaleUpperCase()} file for this site and you MUST follow these rules: 
${additionalPromptForContentType[contentType]}

Do not create the other files for this site, only the ${contentType.toLocaleUpperCase()} file for the path '${path}'.

You MUST ensure that the site is consistent. To ensure consistency you MUST use the content of previous requests defined in <files>. Each <file> in <files> relates to a previous request and contains important content and context that should be used to generate your response.

Use the extracted data from the imported URLs in a <context> tag. Each <context> tag represents a different URL that the user would you to reference or include in the site.

Don't explain your output, just return the required code.
  
If you need to use the date, today's date is: ${new Date().toDateString()}

**The user has confirmed that they own all of the rights to the content and images used.**`;

  const previousRequestContext = context.previousRequests
    .filter((req) => isMediaFile(req.path) === false) // no media files.
    .filter((req) => req.value.content && req.value.content.length != 0) // no current path
    .filter((req) => req.path !== path) // no current path
    .map((req) => {
      console.log(req.path, path);
      console.log("Request", req.path, req.value.content.length);
      return `\t<file name="${req.path}">${req.value.content}</file>`;
    });

  const importedContext = context.importedContext.map((ctx) => {
    return `\t<context name="@url ${ctx.url}" url="${ctx.url}">${ctx.markdown}</context>`;
  });

  // Get user images
  const userImages = await db.getUserImages(site.subdomain);
  const imageData: { [key: string]: Uint8Array } = {};

  // Load image data for all user images
  for (const image of userImages) {
    // This will either download the image from the cache, or from the storage bucket
    const data = await StorageService.downloadImage(site.subdomain, image.id);
    if (data) {
      imageData[image.id] = data;
    }
  }

  // Create base64 encoded images for Claude
  // TODO: Maybe move this to the priovider specific code.
  const images = await Promise.all(
    Object.entries(imageData).map(([id, data]) => {
      const image = userImages.find((img) => img.id === id);
      if (!image) return null;

      return {
        type: "base64" as const,
        media_type: image.mimeType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: encodeBase64(data),
      };
    })
  );

  const prompt: LLMInput = {
    contentType: contentType,
    system: [system],
    files: previousRequestContext,
    context: importedContext,
    prompt: `<prompt>${site.prompt}</prompt>

The attached images can be used to inform the site's colors, themes and layout.

Create a ${contentType.toLocaleUpperCase()} file for the path '${path}' based on the content in <prompt>`,
    images: images.filter(
      (img): img is NonNullable<typeof img> => img !== null
    ),
  };

  const llmProvider = getLLMProvider();
  const response = await llmProvider.generate(prompt);
  console.log("Response from LLM Provider", response);

  // Log the prompt with any used images
  await db.logPrompt(prompt.prompt, prompt.system.join("\n"), site, userImages);

  const content = response.pipeThrough(extractCodeBlocksTS(contentType));

  if (contentType === "html") {
    return content.pipeThrough(parseHtmlStreamForGeneratedImages(site));
  }

  return content;
}
