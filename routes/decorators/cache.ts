import { Cache } from "@makemy/core/cache.ts";
import { getSiteFromHostname } from "@makemy/utils/hostname.ts";
import { db } from "@makemy/core/db.ts";
import { isMediaFile } from "@makemy/utils/contentType.ts";
import { strictEqual } from "node:assert";

const ENV_SaasDomainsAuthToken = Deno.env.get("SAAS_DOMAINS_AUTH_TOKEN");

export function cache({ cache }: { cache: Cache }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
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
        // If served through custom domain proxy then we need to change the cache key to the custom domain
        site = await db.getSiteByDomain(servedForHeader);
        // We shouldn't be really looking in the DB here.... but there is no way to know the context yet.
        if (site) {
          subdomain = site.subdomain;
        }
      } else {
        site = await db.getSite(subdomain);
      }

      // // Skip cache for localhost
      if (subdomain === "localhost") {
        return originalMethod.apply(this, args);
      }

      console.log("Cache name", `${subdomain}:${site?.versionUuid}`);
      const subdomainCache = await caches.open(
        `${subdomain}:${site?.versionUuid}`
      );

      console.log("Checking cache for", subdomain, req.url);
      const cachedResponse = await subdomainCache.match(req);

      if (cachedResponse) {
        console.log("Returning cached response for", subdomain, req.url);
        return cachedResponse;
      }

      const response = await originalMethod.apply(this, args);

      // Only cache successful responses
      if (response.status === 200) {
        console.log("Caching response for", subdomain, req.url);
        if (isMedia == false) {
          // remove this later date
          const path = url.pathname;
          const cacheKey = [subdomain, path];
          cache.set(cacheKey, ""); // The old cache is now just so we know candidate previous requests (wait until matchAll is avaliable)
        }
        await subdomainCache.put(req, response.clone());
      }

      return response;
    };

    return descriptor;
  };
}
