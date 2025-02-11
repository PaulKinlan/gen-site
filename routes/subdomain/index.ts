import { BaseHandler } from "@makemy/routes/base.ts";
import {
  Site,
  SupportedContentType,
  UnsupportedContentType,
} from "@makemy/types.ts";
import { db } from "@makemy/core/db.ts";
import {
  getContentType,
  isMediaFile,
  getMimeType,
} from "@makemy/utils/contentType.ts";
import { getSiteFromHostname } from "@makemy/utils/hostname.ts";
import { cache } from "@makemy/routes/decorators/cache.ts";

import { generateAsset } from "@makemy/core/generate/asset.ts";

import { cacheInstance } from "@makemy/core/cache.ts";

class SubdomainHandler extends BaseHandler {
  @cache({ cache: cacheInstance })
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const hostname = url.hostname;
    const path = url.pathname;
    const contentType: SupportedContentType | UnsupportedContentType =
      getContentType(path);

    if (contentType == "unsupported") {
      console.log(`Unsupported content type: ${path}`);
      return new Response("Unsupported content type", { status: 400 });
    }

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

    // Only block media files that aren't images we can generate
    if (isMediaFile(path) && contentType !== "image") {
      console.log(`Media files are not supported: ${path}`);
      return new Response("Media files are not supported", { status: 400 });
    }

    // Get previous requests for this site
    let content: string | ReadableStream = await generateAsset(
      site,
      url,
      contentType,
      path
    );

    const mimeType = getMimeType(path);
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": mimeType },
    });
  }
}

export default new SubdomainHandler();
