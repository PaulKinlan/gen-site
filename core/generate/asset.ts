import { CacheLine, Cache, cacheInstance } from "@makemy/core/cache.ts";
import { db } from "@makemy/core/db.ts";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { Site } from "@makemy/types.ts";
import { UnsupportedOperationError } from "@makemy/llms/base.ts";
import { generateSiteContent } from "@makemy/core/generate/site.ts";
import { generateDirectImage } from "@makemy/core/generate/image.ts";

export async function generateAsset(site: Site, url: URL, contentType: string) {
  const previousRequestsOld: CacheLine[] =
    (await cacheInstance.getMatching(site.subdomain)) ?? [];

  const previousRequests: CacheLine[] = [];
  const cache = await caches.open(`${site.subdomain}:${site.versionUuid}`);
  for (const previousRequest of previousRequestsOld) {
    const urlToMatch = new URL(url);
    urlToMatch.pathname = previousRequest.path;
    const match = await cache.match(urlToMatch);
    const value = await match?.text();
    previousRequests.push({
      path: previousRequest.path,
      value: {
        content: value || "",
        timestamp: previousRequest.value.timestamp,
      },
    });
  }
  // const cache = await caches.open(site.subdomain);
  // const cachedRequests = await cache.matchAll();
  // for (const cachedRequest of cachedRequests) {
  //   const cacheLine: CacheLine = {
  //     path: cachedRequest.url,
  //     value: {
  //       content: await cachedRequest.text(),
  //       timestamp: Date.now(),
  //     },
  //   };
  //   previousRequests.push(cacheLine);
  // }
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
