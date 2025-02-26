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
//import * as htmlparser2 from "@victr/htmlparser2";
import { encodeBase64 } from "@std/encoding";
import { generate } from "random-words";

export const additionalPromptForContentType: Record<string, string> = {
  html: `+ Generate valid accessible semantic HTML5 markup
+ <meta name="generator" content="MakeMy.blog" />
+ Use the attached images to guide your layout and design choices.
+ The user may include a link to an image URL directly. 
+ The user may ask you to generate or include an image without a URL. You MUST ALWAYS use the following image format: <img data-gen-image="true" data-context="[description of the image to generate]" data-style="[optional style: photo, illustration, watercolor, etc]" data-width="[optional width in pixels]" data-height="[optional height in pixels]" alt="[descriptive alt text]" src="/[descriptive-file-name-for-the-image].jpg">. Never ever use the <img> tag without the data-gen-image attribute.
+ NEVER use the <img> tag with a src pointing an external URL that is not provided in the <prompt>
+ You MAY use inline CSS and <style> blocks, but you must keep all the page styles consistent.
+ You SHOULD prefer not to use JavaScript in the HTML content. If you need to include JavaScript, link to an external file with a descriptive name.`,
  css: "Generate clean, modern (e.g use flex-box and grid), responsive CSS (mobile, desktop and tablet). Include light and dark mode. Use the uploaded images as color inspiration, layout design that is suitable for the provided HTML.",
  js: "Generate clean JavaScript code. Use modern ES6+ syntax. Ensure error handling and browser compatibility.",
};

function parseHtmlStreamForGeneratedImages(site: Site): TransformStream {
  let buffer = "";
  const extractAttribute = (imgString: string, attribute: string): string => {
    const start = imgString.indexOf(`${attribute}=`);
    if (start === -1) {
      return "";
    }
    const end = start + attribute.length + 1;
    const quote = imgString.charAt(end);
    const valueStart = end + 1;
    const valueEnd = imgString.indexOf(quote, valueStart);
    return imgString.substring(valueStart, valueEnd);
  };

  const decoder = new TextDecoder();

  const ts = new TransformStream({
    async transform(chunk, controller) {
      // We are sending to the find the images.
      const chunkText = decoder.decode(chunk, { stream: true });
      // parser.write(chunkText);
      buffer += chunkText;

      let startIndex = 0;
      let endIndex = 0;

      if ((startIndex = buffer.indexOf("<img")) >= 0) {
        // We found an image tag
        endIndex = buffer.indexOf(">", startIndex);
        if (endIndex >= 0) {
          // We have the full img tag.
          const imgTag = buffer.substring(startIndex, endIndex + 1);
          const generated = imgTag.match(/data-gen-image="true"/);
          if (generated) {
            // Get the rest of the details
            const context = extractAttribute(imgTag, "data-context");
            const alt = extractAttribute(imgTag, "alt");
            const src = extractAttribute(imgTag, "src");
            const style = extractAttribute(imgTag, "data-style");
            const width = extractAttribute(imgTag, "data-width");
            const height = extractAttribute(imgTag, "data-height");

            const image: ImageGenerationContext = {
              prompt: context || "",
              alt,
              path: src,
              style: style || undefined,
              width: width ? parseInt(width, 10) : undefined,
              height: height ? parseInt(height, 10) : undefined,
            };

            await db.addSiteImageInformation(site.subdomain, image);

            // We're not ready to clear the buffer yet, there might be another image in it.
            buffer = buffer.substring(endIndex + 1);
          } else {
            //Not an image that needs to be generated. Let's remove it.
            buffer = buffer.substring(endIndex + 1);
          }
        } else {
          // We haven't found the end of the image yet.
        }
      } else {
        // We haven't found an image tag yet, but we don't need all of the buffer, so get rid of all but the last bit where it might be i.e, <im
        buffer = buffer.substring(buffer.length - "<img".length);
      }
      // Always get the content out on to the stream. In theory, we won't get here before we have a full image tag.
      controller.enqueue(chunk);
    },
  });
  return ts;
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

Your task will be create a website and ensure that the design is visually appealing, responsive, and user-friendly. The site's requirements be defined in a <prompt> tag.

When creating an ${contentType.toLocaleUpperCase()} file for this site and you MUST ALWAYS follow these rules:

${additionalPromptForContentType[contentType]}

Only output a single ${contentType.toLocaleUpperCase()} file for the path '${path}'.

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
