import { Route } from "./types.ts";

async function init() {
  const kv = await Deno.openKv();

  // Initialize default site
  const defaultPrompt = await Deno.readTextFile("./prompt.txt");
  await kv.set(["sites", "localhost"], {
    subdomain: "localhost",
    prompt: defaultPrompt,
  });
}

const routes: Route[] = [
  {
    pattern: new URLPattern({
      hostname: "localhost",
      pathname: "/signup",
    }),
    handler: (await import("./routes/main/signup.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "makemy.blog",
      pathname: "/signup",
    }),
    handler: (await import("./routes/main/signup.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "makemy.blog",
      pathname: "/signin",
    }),
    handler: (await import("./routes/main/signin.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "localhost",
      pathname: "/signin",
    }),
    handler: (await import("./routes/main/signin.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "makemy.blog",
      pathname: "/admin/edit",
    }),
    handler: (await import("./routes/main/admin/edit.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "localhost",
      pathname: "/admin/edit",
    }),
    handler: (await import("./routes/main/admin/edit.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "localhost",
      pathname: "/admin",
    }),
    handler: (await import("./routes/main/admin.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "makemy.blog",
      pathname: "/admin",
    }),
    handler: (await import("./routes/main/admin.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "localhost",
      pathname: "/api/generate-name",
    }),
    handler: (await import("./routes/main/api/generate-name.ts")).default,
  },
  {
    pattern: new URLPattern({
      hostname: "makemy.blog",
      pathname: "/api/generate-name",
    }),
    handler: (await import("./routes/main/api/generate-name.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "localhost" }),
    handler: (await import("./routes/main/index.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "0.0.0.0" }),
    handler: (await import("./routes/subdomain/index.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "makemy.blog" }),
    handler: (await import("./routes/main/index.ts")).default,
  },
  {
    pattern: new URLPattern({ hostname: "(.+).itsmy.blog" }),
    handler: (await import("./routes/subdomain/index.ts")).default,
  },
];

await init();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  try {
    const matchingRoute = routes.find((route) => route.pattern.test(url));

    if (matchingRoute === undefined) {
      // No matching route. What do we do about static files
      return new Response("Not Found", { status: 404 });
    }

    return matchingRoute.handler[req.method.toLowerCase()](req);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
});
