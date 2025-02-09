import Anthropic from "@anthropic-ai/sdk";
import { BaseHandler } from "@makemy/routes/base.ts";
import { Site, RequestContext, SupportedContentType } from "@makemy/types.ts";
import { db } from "@makemy/core/db.ts";
import { Cache } from "@makemy/core/cache.ts";
import { getContentType, isMediaFile } from "@makemy/utils/contentType.ts";
import { getSiteFromHostname } from "@makemy/utils/hostname.ts";
import { cache } from "@makemy/routes/decorators/cache.ts";

const cacheInstance = new Cache();
// Initialize the cache immediately
cacheInstance.init().catch((e) => {
  console.error("Failed to initialize cache:", e);
  throw e;
});

const MODEL = "claude-3-5-sonnet-20241022";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
let systemError;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

if (ANTHROPIC_API_KEY == undefined) {
  console.error("Please set the ANTHROPIC_API_KEY environment variable");
  systemError = "Please set the ANTHROPIC_API_KEY environment variable";
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
  html: `You must follow these rules when generating HTML content:
+ Generate valid HTML5 content
+ Include semantic markup and ensure accessibility. 
+ Do not use inline CSS or <style> blocks, instead link to a CSS file with a descriptive name, e.g <link rel="stylesheet" href="/main.css">. Consider CSS from previous requests to enable consistent styling across the site.
+ Prefer not to use JavaScript in the HTML content. If you need to include JavaScript, link to an external file with a descriptive name.`,
  css: "Generate clean, modern CSS. Use flex-box/grid where appropriate. Include responsive design considerations. Include light and dark mode.",
  js: "Generate clean JavaScript code. Use modern ES6+ syntax. Ensure error handling and browser compatibility.",
};

// Site generation helper
async function generateSiteContent(
  path: string,
  site: Site,
  context: RequestContext,
  contentType: SupportedContentType
): Promise<string> {
  const basePrompt = `You are an AI content generator that creates web content for the following site based on the context in the <prompt> tags.

  You will have access to the content of the previous requests in the <files> tag, with each <file> representing a different path on the site.
  
  <prompt>
    ${site.prompt}
  </prompt>`;

  const previousRequestContext =
    context.previousRequests.length > 0
      ? `\n\nContext from previous requests:\n<files>${context.previousRequests
          .map((req) => {
            console.log("REQUEST", req);
            return `\t<file name="${req.path}">\n${req.value.content}\n</file>`;
          })
          .join("\n\n")}</files>`
      : "";

  const importedContext =
    context.importedContext.length > 0
      ? `\n\nImported context for @url references\n<importedContext>${context.importedContext
          .map((ctx) => {
            return `\t<context name="@url ${ctx.url} "url="${ctx.url}">${ctx.markdown}</context>`;
          })
          .join("\n\n")}</importedContext>`
      : "";

  console.log(`Imported Context: ${importedContext}`);

  const prompt = `${basePrompt}
${previousRequestContext}
${importedContext}
${additionalPromptForContentType[contentType]} for path "${path}".`;

  console.log("Prompt:", prompt);

  // TODO: think about system / user roles.
  const message = await anthropic.messages.create({
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    model: MODEL,
  });

  // TODO: Implement Claude/AI integration
  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Expected text content from Claude");
  }
  return extractContentFromMarkdown(content.text, contentType);
}

class SubdomainHandler extends BaseHandler {
  @cache({ cache: cacheInstance })
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const hostname = url.hostname;
    const path = url.pathname;
    const contentType: SupportedContentType = getContentType(path);

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

    if (isMediaFile(path)) {
      console.log(`Media files are not supported: ${path}`);
      return new Response("Media files are not supported", { status: 400 });
    }

    // Get previous requests for this site
    const previousRequests = (await cacheInstance.getMatching(siteId)) ?? [];
    // Get the extacted markdown for @url syntax
    const importedContext =
      (await db.getAllExtractedMarkdown(site.subdomain)) ?? [];

    const content = await generateSiteContent(
      path,
      site,
      { previousRequests, importedContext },
      contentType
    );

    return new Response(content, {
      status: 200,
      headers: { "Content-Type": `text/${contentType}` },
    });
  }
}

export default new SubdomainHandler();
