/// <reference lib="deno.ns" />
import {
  Route,
  Site,
  UserImage,
  ValidHTTPMethodForRoute,
} from "@makemy/types.ts";
import { crawlSitesUrls } from "@makemy/tasks/crawl-urls.ts";
import { initQueueHandler } from "@makemy/queue.ts";
import { StorageService } from "@makemy/core/storage.ts";
import { db } from "@makemy/core/db.ts";
import { auth } from "@makemy/utils/auth.ts";

async function init() {
  const kv = await Deno.openKv();

  // Load all prompts into cache
  for await (const entry of Deno.readDir("./routes/subdomain/prompts")) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      const subdomain = entry.name.slice(0, -3); // Remove .md extension
      const content = await Deno.readTextFile(
        `./routes/subdomain/prompts/${entry.name}`
      );

      if (subdomain === "localhost") {
        // we don't need to create the other domains
        let user = await db.getUserById(subdomain);
        if (user == null) {
          await db.createUser({
            id: subdomain,
            email: "admin@localhost",
            passwordHash: await auth.hashPassword("password"),
            username: subdomain,
            createdAt: new Date(),
          });

          user = await db.getUserById(subdomain);
        }

        const site: Site = {
          subdomain,
          versionUuid: crypto.randomUUID(),
          prompt: content,
          userId: user.id,
        };

        await db.createSite(site);
      }
    } else if (entry.isFile && entry.name.endsWith(".png")) {
      console.log("Uploading image", entry.name);
      const subdomain = entry.name.slice(0, -4); // Remove .png extension
      const localImage = await Deno.readFile(
        `./routes/subdomain/prompts/${entry.name}`
      );

      const imageId = `${entry.name}`;
      const imageData = await localImage;

      // Store image metadata
      const image: UserImage = {
        id: imageId,
        subdomain: subdomain,
        filename: entry.name,
        mimeType: "image/png",
        createdAt: new Date(),
      };

      // Upload to storage with resizing
      await StorageService.uploadImage(
        subdomain,
        image.id,
        new Uint8Array(imageData),
        "image/png",
        {
          width: 1568, // Always resize to max dimensions on upload
          height: 1568,
        }
      );

      // Save metadata after successful upload
      await db.saveUserImage(image);
    }
  }

  // Start the initial crawl and set up recurring crawl
  await initQueueHandler();
  await crawlSitesUrls();

  Deno.cron(
    "Schedule Extract Markdown Tasks every hour",
    "0 * * * *",
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
        pathname: "/admin/prompt-logs",
      }),
      handler: (await import("./routes/main/admin/prompt-logs.ts")).default,
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
        pathname: "/api/user-images",
      }),
      handler: (await import("./routes/main/api/user-images.ts")).default,
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
