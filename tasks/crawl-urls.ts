import { db } from "@makemy/core/db.ts";

const kv = await Deno.openKv();

// Set up cron job to crawl URLs every 24 hours

async function crawlSitesUrls() {
  console.log("Starting URL crawl...");

  // List all entries with the sites_urls prefix
  const entries = await db.getAllUrlsToMonitor();

  for (const [key, entry] of Object.entries(entries)) {
    console.log(`Processing ${key}, ${entry.length} URLs`);
    const subdomain = key;
    const urls = entry;
    for (const url of urls) {
      console.log(`Processing ${url}`);
      if (typeof subdomain === "string" && typeof url === "string") {
        // Queue a new task to process this URL
        await kv.enqueue(
          { message: "extract-markdown", site: subdomain, url },
          { delay: 0 } // No delay for cron job execution
        );
        console.log(`Queued task for ${url} (${subdomain})`);
      }
    }
  }

  console.log("URL crawl complete");
}

if (import.meta.main) {
  // Start the initial crawl
  await crawlSitesUrls();
}

export { crawlSitesUrls };
