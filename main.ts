/// <reference lib="deno.ns" />
import { Route, ValidHTTPMethodForRoute } from "@makemy/types.ts";
import { crawlSitesUrls } from "@makemy/tasks/crawl-urls.ts";
import { initQueueHandler } from "@makemy/queue.ts";

async function init() {
  const kv = await Deno.openKv();

  // Load all prompts into cache
  for await (const entry of Deno.readDir("./routes/subdomain/prompts")) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      const subdomain = entry.name.slice(0, -3); // Remove .md extension
      const content = await Deno.readTextFile(
        `./routes/subdomain/prompts/${entry.name}`
      );
      await kv.set(["sites", subdomain], {
        subdomain: subdomain,
        prompt: content,
      });
    }
  }

  // Start the initial crawl and set up recurring crawl
  await initQueueHandler();
  await crawlSitesUrls();

  Deno.cron(
    "Schedule Extract Markdown Tasks every 10 minutes",
    "*/10 * * * *",
    async () => {
      // Start the initial crawl and set up recurring crawl
      await crawlSitesUrls();
    }
  );
}

const buildMainRoutes = async (hostname: string) => {
  return [
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/signup",
      }),
      handler: (await import("./routes/main/signup.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/signin",
      }),
      handler: (await import("./routes/main/signin.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/admin/edit",
      }),
      handler: (await import("./routes/main/admin/edit.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/admin",
      }),
      handler: (await import("./routes/main/admin.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/admin/domains",
      }),
      handler: (await import("./routes/main/admin/domains.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/api/generate-name",
      }),
      handler: (await import("./routes/main/api/generate-name.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/api/check-name",
      }),
      handler: (await import("./routes/main/api/check-name.ts")).default,
    },
    {
      pattern: new URLPattern({
        hostname,
        pathname: "/api/fetch-markdown",
      }),
      handler: (await import("./routes/main/api/fetch-markdown.ts")).default,
    },
    {
      // Catch all for the main site
      pattern: new URLPattern({ hostname }),
      handler: (await import("./routes/main/index.ts")).default,
    },
  ];
};

function isValidHTTPMethod(method: string): method is ValidHTTPMethodForRoute {
  const lowerCaseMethod = method.toLowerCase();
  return (
    lowerCaseMethod === "get" ||
    lowerCaseMethod === "post" ||
    lowerCaseMethod === "put" ||
    lowerCaseMethod === "delete"
  );
}

const routes: Route[] = [
  ...(await buildMainRoutes("localhost")),
  ...(await buildMainRoutes("makemy.blog")),
  {
    pattern: new URLPattern({ hostname: "localhost" }),
    handler: (await import("./routes/main/index.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "0.0.0.0" }),
    handler: (await import("./routes/subdomain/index.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "(.+).itsmy.blog" }),
    handler: (await import("./routes/subdomain/index.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "(.+).itsmy.blog" }),
    handler: (await import("./routes/subdomain/index.ts")).default,
  },
];

await init();

const ENV_SaasDomainsAuthToken = Deno.env.get("SAAS_DOMAINS_AUTH_TOKEN");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const SaasDomainsAuthToken = req.headers.get("X-SaaS-Domains-Auth-Token");
  const Host = req.headers.get("Host");

  try {
    let matchingRoute = routes.find((route) => route.pattern.test(url));

    if (matchingRoute === undefined) {
      // No matching route. What do we do about static files
      if (SaasDomainsAuthToken == ENV_SaasDomainsAuthToken) {
        matchingRoute = {
          pattern: new URLPattern({ hostname: "(.+).itsmy.blog" }),
          handler: (await import("./routes/subdomain/index.ts")).default,
        };
        console.log(
          `Using subdomain handler for: ${Host} - ${SaasDomainsAuthToken} --- ${ENV_SaasDomainsAuthToken}`
        );
      } else {
        return new Response("Not Found", { status: 404 });
      }
    }

    const method = req.method.toLowerCase();
    if (isValidHTTPMethod(method)) {
      const handler = matchingRoute.handler;

      switch (method) {
        case "get":
          return handler.get(req);
        case "post":
          return handler.post(req);
        case "put":
          return handler.put(req);
        case "delete":
          return handler.delete(req);
      }
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (e: unknown) {
    const error = e as Error;
    return new Response(error.message, { status: 500 });
  }
});
