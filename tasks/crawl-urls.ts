import { kv } from "@makemy/core/db.ts";

// Set up cron job to crawl URLs every 24 hours

async function crawlSitesUrls() {
  console.log("Starting URL crawl...");

  // List all entries with the sites_urls prefix
  const entries = kv.list<string>({ prefix: ["sites_urls"] });

  for await (const entry of entries) {
    const [, subdomain, url] = entry.key;
    if (typeof subdomain === "string" && typeof url === "string") {
      // Queue a new task to process this URL
      await kv.enqueue(
        { site: subdomain, url },
        { delay: 0 } // No delay for cron job execution
      );
      console.log(`Queued task for ${url} (${subdomain})`);
    }
  }

  console.log("URL crawl complete");
}

if (import.meta.main) {
  // Start the initial crawl
  await crawlSitesUrls();
}

export { crawlSitesUrls };
