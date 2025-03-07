import { CacheLine, Cache, cacheInstance } from "@makemy/core/cache.ts";
import { db } from "@makemy/core/db.ts";
import { Site, SupportedContentType } from "@makemy/types.ts";
import { generateSiteContent } from "@makemy/core/generate/site.ts";
import { generateDirectImage } from "@makemy/core/generate/image.ts";

export async function generateAsset(
  site: Site,
  url: URL,
  contentType: SupportedContentType
) {
  const previousRequestsOld: CacheLine[] =
    (await cacheInstance.getMatching(site.subdomain)) ?? [];

  const previousRequests: CacheLine[] = [];
  const cache = await caches.open(`${site.subdomain}:${site.versionUuid}`);

  for (const previousRequest of previousRequestsOld) {
    const urlToMatch = new URL(url);
    urlToMatch.pathname = previousRequest.path;
    const match = await cache.match(urlToMatch);
    if (match === undefined) {
      continue;
    }
    const value = await match?.text();
    previousRequests.push({
      path: previousRequest.path,
      value: {
        content: value || "",
        timestamp: previousRequest.value.timestamp,
      },
    });
  }

  // Get the extracted markdown for @url syntax
  const importedContext =
    (await db.getAllExtractedMarkdown(site.subdomain)) ?? [];

  let content: string | ReadableStream;
  if (contentType === "image") {
    //
    content = await generateDirectImage(url.pathname.replace(/^\//, ""), site, {
      previousRequests,
      importedContext,
      url,
    });
  } else {
    content = await generateSiteContent(
      url.pathname,
      site,
      { previousRequests, importedContext, url },
      contentType
    );
  }
  return content;
}
