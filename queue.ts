import { extractMarkdown } from "@makemy/utils/extractMarkdown.ts";
import { db } from "@makemy/core/db.ts";
import { generateAsset } from "@makemy/core/generate/asset.ts";
import { Site } from "@makemy/types.ts";

// Get a reference to a KV database
const kv = await Deno.openKv();

// Define the shape of the object we expect as a message in the queue
export interface ExtractMarkdownMessage {
  message: "extract-markdown";
  // The subdomain for the account
  site: string;
  // The url to fetch
  url: string;
}

export interface GenerateSiteMessage {
  message: "generate-site";
  site: Site;
}

// Create a type guard to check the type of the incoming message
function isExtractMarkdown(o: unknown): o is ExtractMarkdownMessage {
  return (
    (o as ExtractMarkdownMessage)?.message == "extract-markdown" &&
    typeof (o as ExtractMarkdownMessage).site === "string" &&
    (o as ExtractMarkdownMessage)?.url !== undefined &&
    typeof (o as ExtractMarkdownMessage).url === "string"
  );
}

function isGenerateSite(o: unknown): o is GenerateSiteMessage {
  return (
    (o as GenerateSiteMessage)?.message == "generate-site" &&
    (o as GenerateSiteMessage)?.site !== undefined
  );
}

export async function initQueueHandler() {
  // Register a handler function to listen for values - this example shows
  // how you might send a notification
  kv.listenQueue(async (msg: unknown) => {
    // Use type guard - then TypeScript compiler knows msg is a Notification
    if (isExtractMarkdown(msg)) {
      console.log(`Extracting markdown for ${msg.site} at ${msg.url}`);
      if (!msg.url.startsWith("http")) {
        console.error("Skipping Invalid URL:", msg.url);
        return;
      }
      const response = await fetch(msg.url);
      const html = await response.text();
      const markdown = extractMarkdown(html);
      // ... do something to actually send the notification!
      db.setExtractedMarkdown(msg.site, msg.url, markdown.markdown);
    } else if (isGenerateSite(msg)) {
      // If the message is of an unknown type, it might be an error
      const siteUrl = new URL("/", `https://${msg.site.subdomain}.itsmy.blog`);
      const content = await generateAsset(msg.site, siteUrl, "html");
      const cache = await caches.open(
        `${msg.site.subdomain}:${msg.site.versionUuid}`
      );
      await cache.put(
        siteUrl,
        new Response(content, {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );
    } else {
      console.error("Unknown message received:", msg);
    }
  });
}
