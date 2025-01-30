import { Site, RequestContext, SupportedContentType } from "./types.ts";
import { db } from "./db.ts";
import { auth } from "./auth.ts";
import { Cache } from "./cache.ts";
import { getContentType } from "./utils/contentType.ts";
import { getSiteFromHostname } from "./utils/hostname.ts";
import Anthropic from "@anthropic-ai/sdk";

const cache = new Cache();
const MODEL = "claude-3-5-sonnet-20241022";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
let systemError;

if (ANTHROPIC_API_KEY == undefined) {
  console.error("Please set the ANTHROPIC_API_KEY environment variable");
  systemError = "Please set the ANTHROPIC_API_KEY environment variable";
}

console.log(ANTHROPIC_API_KEY);

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function init() {
  const kv = await Deno.openKv();

  // Initialize default site
  const defaultPrompt = await Deno.readTextFile("./prompt.txt");
  await kv.set(["sites", "localhost"], {
    subdomain: "localhost",
    prompt: defaultPrompt,
  });
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

// Site generation helper
async function generateSiteContent(
  path: string,
  site: Site,
  context: RequestContext,
  contentType: SupportedContentType
): Promise<string> {
  const basePrompt = `You are an AI content generator that creates web content for the following site:\n\n${site.prompt}`;

  const contextPrompt =
    context.previousRequests.length > 0
      ? `\n\nContext from previous requests:\n${context.previousRequests
          .map((req) => `<file name="${req.path}">\n${req.content}\n</file>`)
          .join("\n\n")}`
      : "";

  const prompt = `${basePrompt}${contextPrompt}\n\nGenerate ${contentType.toUpperCase()} content for the path "${path}".`;

  // TODO: think about system / user roles.
  const message = await anthropic.messages.create({
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    model: MODEL,
  });

  // TODO: Implement Claude/AI integration
  return extractContentFromMarkdown(message.content[0].text, contentType);
}

await init();

Deno.serve(async (req: Request) => {
  if (systemError) {
    return new Response(systemError, { status: 500 });
  }

  const url = new URL(req.url);
  const hostname = url.hostname;

  if (hostname === "makemy.blog") {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const userId = await auth.verifyToken(token);
      if (userId) {
        // Handle authenticated admin requests
        return new Response("Admin UI");
      }
    }
    return new Response("Unauthorized", { status: 401 });
  }

  const subdomain = getSiteFromHostname(hostname);
  const path = url.pathname;
  const cacheKey = `${subdomain}:${path}`;

  const cached = cache.get(cacheKey);
  if (cached) return new Response(cached);

  const site = await db.getSite(subdomain);
  if (!site) return new Response("Site not found", { status: 404 });

  const contentType: SupportedContentType = getContentType(path);

  const content = await generateSiteContent(
    path,
    site,
    { previousRequests: [] },
    contentType
  );
  cache.set(cacheKey, content);

  return new Response(content, {
    headers: { "Content-Type": `text/${contentType}` },
  });
});
