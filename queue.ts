import { extractMarkdown } from "@makemy/utils/extractMarkdown.ts";
import { db } from "@makemy/core/db.ts";
// Get a reference to a KV database
const kv = await Deno.openKv();

// Define the shape of the object we expect as a message in the queue
export interface ExtractMarkdownMessage {
  // The subdomain for the account
  site: string;
  // The url to fetch
  url: string;
}

// Create a type guard to check the type of the incoming message
function isExtractMarkdown(o: unknown): o is ExtractMarkdownMessage {
  return (
    (o as ExtractMarkdownMessage)?.site !== undefined &&
    typeof (o as ExtractMarkdownMessage).site === "string" &&
    (o as ExtractMarkdownMessage)?.url !== undefined &&
    typeof (o as ExtractMarkdownMessage).url === "string"
  );
}

export async function initQueueHandler() {
  // Register a handler function to listen for values - this example shows
  // how you might send a notification
  kv.listenQueue(async (msg: unknown) => {
    // Use type guard - then TypeScript compiler knows msg is a Notification
    if (isExtractMarkdown(msg)) {
      console.log(`Extracting markdown for ${msg.site} at ${msg.url}`);
      const response = await fetch(msg.url);
      const html = await response.text();
      const markdown = extractMarkdown(html);
      // ... do something to actually send the notification!
      db.setExtractedMarkdown(msg.site, msg.url, markdown.markdown);
    } else {
      // If the message is of an unknown type, it might be an error
      console.error("Unknown message received:", msg);
    }
  });
}
