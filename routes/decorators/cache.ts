import { Cache } from "../../cache.ts";
import { getContentType } from "../../utils/contentType.ts";
import { getSiteFromHostname } from "../../utils/hostname.ts";
import { isMediaFile } from "../../utils/contentType.ts";
import { db } from "../../db.ts";

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
      const path = url.pathname;
      const contentType = getContentType(path);
      const hostname = url.hostname;
      let subdomain = getSiteFromHostname(hostname);

      if (subdomain === undefined) {
        return new Response("Subdomain not found", { status: 404 });
      }

      if (isMediaFile(url.toString())) {
        // Don't attempt to find image files in the cache.
        return originalMethod.apply(this, args);
      }

      const SaasDomainsAuthToken = req.headers.get("X-SaaS-Domains-Auth-Token");

      const servedForHeader = req.headers.get("X-Served-For");
      if (servedForHeader && ENV_SaasDomainsAuthToken == SaasDomainsAuthToken) {
        // If served through custom domain proxy then we need to change the cache key to the custom domain
        const site = await db.getSiteByDomain(servedForHeader);
        // We shouldn't be really looking in the DB here.... but there is no way to know the context yet.
        if (site) {
          subdomain = servedForHeader;
        }
      }

      // Skip cache for localhost
      // if (subdomain === "localhost") {
      //   return originalMethod.apply(this, args);
      // }

      const cacheKey = [subdomain, path];

      console.log("looking for cache:", cacheKey);
      const cached = await cache.get(cacheKey);

      if (cached) {
        console.log("Cache hit for", cacheKey, "Content:", cached.length);
        return new Response(cached, {
          status: 200,
          headers: { "Content-Type": `text/${contentType}` },
        });
      }

      const response = await originalMethod.apply(this, args);

      // Only cache successful responses
      if (response.status === 200) {
        const content = await response.clone().text();
        await cache.set(cacheKey, content);
      }

      return response;
    };

    return descriptor;
  };
}
