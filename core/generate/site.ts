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
import * as htmlparser2 from "@victr/htmlparser2";
import subdomain from "@makemy/routes/subdomain/index.ts";
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

async function parseHtmlStreamForGeneratedImages(
  stream: ReadableStream<Uint8Array>
): Promise<ImageGenerationContext[]> {
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

        const image: GeneratedImage = {
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
        generatedImages.push(image);
      }
    },
    onerror: (error: Error) => {
      console.error("Parser error:", error);
    },
  });
  const decoder = new TextDecoder();
  let buffer = "";
  const generatedImages: ImageGenerationContext[] = [];

  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (buffer.length > 0) {
          parser.write(buffer);
        }
        break;
      }

      if (value) {
        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;

        try {
          parser.write(buffer); //Feed the current buffer.
          buffer = ""; //If successfull reset the buffer.
        } catch (e) {
          //The parser might not be able to handle the current buffer, save for later.
        }
      }
    }
  } finally {
    reader.releaseLock();
    parser.end();
  }

  return generatedImages;
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

async function* extractCodeBlocks(
  readableStream: ReadableStream,
  contentType: SupportedContentType
): AsyncGenerator<Uint8Array> {
  const reader = readableStream.getReader();
  let buffer = "";
  let inCodeBlock = false;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      if (inCodeBlock) {
        yield new TextEncoder().encode(buffer); // Yield any remaining code
      }
      break;
    }

    buffer += value;

    let startIndex = 0;

    if (inCodeBlock == false) {
      if (
        (startIndex = buffer.indexOf("```" + contentType, startIndex)) !== -1
      ) {
        inCodeBlock = true;
        yield new TextEncoder().encode(
          buffer.substring(startIndex + 3 + contentType.length)
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
        yield new TextEncoder().encode(buffer.substring(0, endIndex)); // Don't go past endIndex
        // Because we are only managing one code block we can return;
        return;
      }
      // Yield all the text
      yield new TextEncoder().encode(buffer.substring(startIndex));
      buffer = "";
    }
  }
}

function extractContentFromMarkdownStream(
  stream: ReadableStream,
  contentType: SupportedContentType
): ReadableStream {
  return new ReadableStream({
    async pull(controller) {
      for await (const chunk of extractCodeBlocks(stream, contentType)) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

export async function generateSiteContent(
  path: string,
  site: Site,
  context: RequestContext,
  contentType: SupportedContentType
): Promise<ReadableStream> {
  const system = `You are an expert web developer that creates web content for the following site based on the context in the <prompt> tags.

  You will have access to the content of the previous requests in the <file> tags, with each <file> representing a different path on the site.

  You will also have access to the extracted context from the imported URLs in the <importedContext> tag, with each <context> representing a different URL that the user would you to reference.`;

  const previousRequestContext = context.previousRequests
    .filter((req) => isMediaFile(req.path) === false) // no media files.
    .filter((req) => req.value.content && req.value.content.length != 0) // no current path
    .map((req) => {
      return `\t<file name="${req.path}">\n${req.value.content}\n</file>`;
    });

  const importedContext = context.importedContext.map((ctx) => {
    return `\t<context name="@url ${ctx.url} "url="${ctx.url}">${ctx.markdown}</context>`;
  });

  const prompt: LLMInput = {
    system: [system],
    files: previousRequestContext,
    context: importedContext,
    prompt: `<prompt>
    ${site.prompt}
  </prompt>
  
   Using the URL pathname '${path}' and using the description in <prompt>, create a ${contentType} file that follows these rules: ' ${additionalPromptForContentType[contentType]}`,
  };

  const llmProvider = getLLMProvider();
  const response = await llmProvider.generate(prompt);
  console.log("Response from LLM Provider", response);

  // Log the prompt
  console.log(prompt);
  await db.logPrompt(prompt.prompt, prompt.system.join("\n"), site);
  const tees = response.tee();
  const content = extractContentFromMarkdownStream(tees[0], contentType);
  let imageTees = content.tee();

  if (contentType === "html") {
    const images = await parseHtmlStreamForGeneratedImages(imageTees[1]);
    for (const image of images) {
      console.log("Adding image to site", site, image);
      await db.addSiteImageInformation(site.subdomain, image);
    }
  }

  return imageTees[0];
}
