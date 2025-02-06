import { Cache } from "../../cache.ts";
import { getContentType } from "../../utils/contentType.ts";
import { getSiteFromHostname } from "../../utils/hostname.ts";

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
      const subdomain = getSiteFromHostname(hostname);
      const path = url.pathname;
      const contentType = getContentType(path);

      if (subdomain === undefined) {
        return new Response("Subdomain not found", { status: 404 });
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
