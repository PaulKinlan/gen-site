import { Cache } from "@makemy/core/cache.ts";
import { getSiteFromHostname } from "@makemy/utils/hostname.ts";
import { db } from "@makemy/core/db.ts";
import { isMediaFile } from "@makemy/utils/contentType.ts";

const ENV_SaasDomainsAuthToken = Deno.env.get("SAAS_DOMAINS_AUTH_TOKEN");

export function cache({ cache }: { cache: Cache }) {
  return function (
    originalMethod: (req: Request) => Promise<Response>,
    _context: ClassMethodDecoratorContext
  ) {
    async function cachedMethod(
      this: unknown,
      ...args: [Request]
    ): Promise<Response> {
      const [req] = args;
      const url = new URL(req.url);
      const hostname = url.hostname;
      let subdomain = getSiteFromHostname(hostname);

      const isMedia = isMediaFile(url.pathname);

      if (subdomain === undefined) {
        return new Response("Subdomain not found", { status: 404 });
      }

      const SaasDomainsAuthToken = req.headers.get("X-SaaS-Domains-Auth-Token");
      let site;
      const servedForHeader = req.headers.get("X-Served-For");
      if (servedForHeader && ENV_SaasDomainsAuthToken == SaasDomainsAuthToken) {
        site = await db.getSiteByDomain(servedForHeader);
        if (site) {
          subdomain = site.subdomain;
        }
      } else {
        site = await db.getSite(subdomain);
      }

      if (subdomain === "localhost") {
        return originalMethod.call(this, ...args);
      }

      console.log("Cache name", `${subdomain}:${site?.versionUuid}`);
      const subdomainCache = await caches.open(
        `${subdomain}:${site?.versionUuid}`
      );

      console.log("Checking cache for", subdomain, req.url);
      const cachedResponse = await subdomainCache.match(url);

      if (cachedResponse) {
        console.log("Returning cached response for", subdomain, req.url);
        return cachedResponse;
      }

      const response = await originalMethod.call(this, ...args);

      if (response.status === 200) {
        console.log(
          "Caching response for",
          subdomain,
          req.url,
          site?.versionUuid
        );
        if (isMedia == false) {
          const path = url.pathname;
          const cacheKey = [subdomain, path];
          cache.set(cacheKey, "");
        }
        await subdomainCache.put(url, response.clone());
      }

      return response;
    }

    return cachedMethod;
  };
}
