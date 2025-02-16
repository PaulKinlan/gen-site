import { Cache } from "@makemy/core/cache.ts";

export function permanentCache() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [req] = args;
      const url = new URL(req.url);

      // Use a dedicated cache for permanent assets
      const permanentCache = await caches.open("permanent-assets");

      console.log("Checking permanent cache for", req.url);
      const cachedResponse = await permanentCache.match(req);

      if (cachedResponse) {
        console.log("Returning cached response for", req.url);
        return cachedResponse;
      }

      const response = await originalMethod.apply(this, args);

      // Only cache successful responses
      if (response.status === 200) {
        console.log("Caching response permanently for", req.url);

        // Clone the response and set cache headers
        const responseToCache = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        });

        // Set cache control headers for permanent caching
        responseToCache.headers.set(
          "Cache-Control",
          "public, max-age=31536000, immutable"
        );

        await permanentCache.put(req, responseToCache.clone());
        return responseToCache;
      }

      return response;
    };

    return descriptor;
  };
}
